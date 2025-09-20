import { SupportedNetwork, UTXO } from '../globalTypes.js';
import { ChainProvider } from './chainProvider.js';
import fetch from 'cross-fetch';
import { UtxoProvider, UtxoQueryOptions, getUtxoKey } from './utxoProvider.js';
import { uint8ArrayToHex, duplicateFilter } from '../utils/common.js';
import { Script } from '@opcat-labs/opcat';
import { util } from '@opcat-labs/opcat';
import { sha256 } from '../smart-contract/fns/index.js';

/**
 * The MempoolProvider is backed by [Mempool]{@link https://opcatlabs.io}
 * @category Provider
 */
export class MempoolProvider implements ChainProvider, UtxoProvider {
  private broadcastedTxs: Map<string, string> = new Map();
  private spentUTXOs = new Set<string>();

  private newUTXOs = new Map<string, UTXO>();

  constructor(public readonly network: SupportedNetwork) {}

  async getNetwork(): Promise<SupportedNetwork> {
    return this.network;
  }

  async getUtxos(addressOrScript: string, _options?: UtxoQueryOptions): Promise<UTXO[]> {
    // const script = uint8ArrayToHex(Script.fromAddress(address).toBuffer());
    let script: string;
    let url = ''
    if (util.js.isHexaString(addressOrScript)) {
      script = addressOrScript;
      url = `${this.getMempoolApiHost()}/api/scripthash/${sha256(addressOrScript)}/utxo`;
    } else {
      script = uint8ArrayToHex(Script.fromAddress(addressOrScript).toBuffer());
      url = `${this.getMempoolApiHost()}/api/address/${addressOrScript}/utxo`;
    }

    const utxos: Array<UTXO> = await fetch(url)
      .then(async (res) => {
        const contentType = res.headers.get('content-type');
        if (contentType.includes('json')) {
          return res.json();
        } else {
          throw new Error(`invalid http content type : ${contentType}, status: ${res.status}`);
        }
      })
      .then(
        (
          utxos: Array<{
            txid: string;
            vout: number;
            script: string;
            value: number;
            data: string;
          }>,
        ) =>
          utxos.map((utxo) => {
            return {
              txId: utxo.txid,
              outputIndex: utxo.vout,
              script: utxo.script || script,
              satoshis: utxo.value,
              data: utxo.data || '',
            };
          }),
      )
      .catch((_e) => {
        return [];
      });

    return utxos
      .concat(Array.from(this.newUTXOs.values()))
      .filter((utxo) => this.isUnSpent(utxo.txId, utxo.outputIndex))
      .filter(duplicateFilter((utxo) => `${utxo.txId}:${utxo.outputIndex}`))
      .sort((a, b) => a.satoshis - b.satoshis);
  }

  private isUnSpent(txId: string, vout: number) {
    const key = `${txId}:${vout}`;
    return !this.spentUTXOs.has(key);
  }

  markSpent(txId: string, vout: number) {
    const key = `${txId}:${vout}`;
    if (this.newUTXOs.has(key)) {
      this.newUTXOs.delete(key);
    }
    this.spentUTXOs.add(key);
  }
  addNewUTXO(utxo: UTXO) {
    this.newUTXOs.set(getUtxoKey(utxo), utxo);
  }

  getFeeRate(): Promise<number> {
    const url = `${this.getMempoolApiHost()}/api/v1/fees/recommended`;
    return fetch(url, {})
      .then((res) => {
        const contentType = res.headers.get('content-type');
        if (contentType.includes('json')) {
          return res.json();
        } else {
          return res.text();
        }
      })
      .then((data) => {
        return data.economyFee || 1;
      })
      .catch((e: Error) => {
        return e;
      });
  }
  async getConfirmations(txId: string): Promise<number> {
    const res = await this._getConfirmations(txId);
    if (res instanceof Error) {
      throw new Error(`getConfirmations failed, ${res.message}`);
    }

    return res.confirmations;
  }

  private getMempoolApiHost = () => {
    if (this.network === 'opcat-testnet') {
      return 'https://testnet.opcatlabs.io';
    } else if (this.network === 'opcat-mainnet') {
      return 'https://mempool.opcatlabs.io';
    } else {
      throw new Error(`Unsupport network: ${this.network}`);
    }
  };

  private async _broadcast(txHex: string): Promise<string | Error> {
    const url = `${this.getMempoolApiHost()}/api/tx`;
    return fetch(url, {
      method: 'POST',
      body: txHex,
    })
      .then(async (res) => {
        const contentType = res.headers.get('content-type');
        if (contentType.includes('json')) {
          return res.json();
        } else {
          return res.text();
        }
      })
      .then(async (data) => {
        if (typeof data === 'string' && data.length === 64) {
          return data;
        } else if (typeof data === 'object') {
          throw new Error(JSON.stringify(data));
        } else if (typeof data === 'string') {
          throw new Error(data);
        } else {
          throw new Error('unknow error');
        }
      })
      .catch((e) => {
        return e;
      });
  }

  private async _getConfirmations(txid: string): Promise<
    | {
        blockhash: string;
        confirmations: number;
      }
    | Error
  > {
    const url = `${this.getMempoolApiHost()}/api/tx/${txid}/status`;
    return fetch(url, {})
      .then(async (res) => {
        const contentType = res.headers.get('content-type');
        if (contentType.includes('json')) {
          return res.json();
        } else {
          return res.text();
        }
      })
      .then(async (data) => {
        if (typeof data === 'object') {
          return {
            blockhash: data['block_hash'],
            confirmations: data['confirmed'] ? 1 : -1,
          };
        } else if (typeof data === 'string') {
          throw new Error(data);
        } else {
          throw new Error('unknow error');
        }
      })
      .catch((e) => {
        return e;
      });
  }

  async broadcast(txHex: string): Promise<string> {
    const res = await this._broadcast(txHex);
    if (res instanceof Error) {
      throw res;
    }
    this.broadcastedTxs.set(res, txHex);
    return res;
  }

  async getRawTransaction(txId: string): Promise<string> {
    let txHex = this.broadcastedTxs.get(txId);
    if (!txHex) {
      const res = await this._getRawTransaction(txId);

      if (res instanceof Error) {
        throw new Error(
          `Can not find the tx with id ${txId}, please broadcast it by using the TestProvider first`,
        );
      }
      txHex = res;
    }
    return txHex;
  }

  private async _getRawTransaction(txid: string): Promise<string | Error> {
    const url = `${this.getMempoolApiHost()}/api/tx/${txid}/hex`;
    return fetch(url, {})
      .then((res) => {
        if (res.status !== 200) {
          throw new Error(`invalid http response code: ${res.status}`);
        }
        return res.text();
      })
      .then((txhex: string) => {
        return txhex;
      })

      .catch((e: Error) => {
        return e;
      });
  }
}
