import { SupportedNetwork, TxId, UTXO } from '../globalTypes.js';
import { ChainProvider } from './chainProvider.js';
import fetch from 'cross-fetch';
import { UtxoProvider, UtxoQueryOptions, getUtxoKey } from './utxoProvider.js';
import { uint8ArrayToHex, duplicateFilter } from '../utils/common.js';
import { Script } from '@opcat-labs/opcat';
import { ExtPsbt } from '../psbt/extPsbt.js';

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

  async getUtxos(address: string, _options?: UtxoQueryOptions): Promise<UTXO[]> {
    const script = uint8ArrayToHex(Script.fromAddress(address).toBuffer());

    const url = `${this.getMempoolApiHost()}/api/address/${address}/utxo`;
    const requiredSat = _options?.unspentValue || 0; // 0 means fetch all utxos
    let totalUtxos: UTXO[] = []
    
    const limit = 50;
    let after_txid: string
    let after_vout: number
    while(true) {
      const query = after_txid ? `?max_utxos=${limit}&after_txid=${after_txid}&after_vout=${after_vout}` : `?max_utxos=${limit}`
      const resp = await fetch(url + query);
      const contentType = resp.headers.get('content-type')
      if (contentType.includes('json')) {
        const res = await resp.json();
        if (res['error']) throw new Error(res['error']);
        const utxos: UTXO[] = res.map(utxo => ({
          txId: utxo.txid,
          outputIndex: utxo.vout,
          script: utxo.script || script,
          satoshis: utxo.value,
          data: utxo.data || ''
        }))
        totalUtxos = [...totalUtxos, ...utxos]
          .concat(Array.from(this.newUTXOs.values()))
          .filter((utxo) => this.isUnSpent(utxo.txId, utxo.outputIndex))
          .filter(duplicateFilter((utxo) => `${utxo.txId}:${utxo.outputIndex}`))
          .filter(utxo => utxo.script === script)
          .sort((a, b) => a.satoshis - b.satoshis);
        const lastUtxo = utxos.at(-1)
        if (lastUtxo) {
          after_txid = lastUtxo.txId
          after_vout = lastUtxo.outputIndex
        }
        if (utxos.length < limit) break;
        const totalSatoshis = totalUtxos.reduce((total, utxo) => total + utxo.satoshis, 0)
        if (requiredSat > 0 && totalSatoshis >= requiredSat) break;
      } else {
        throw new Error(`invalid http content type : ${contentType}, status: ${resp.status}`);
      }
    }
    return totalUtxos;
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

  private async _getTipHeight(): Promise<number> {
    
    const tipHeightUrl = `${this.getMempoolApiHost()}/api/blocks/tip/height`;
    const tipHeight = await fetch(tipHeightUrl, {})
      .then((res) => {
        if (res.status !== 200) {
          throw new Error(`invalid http response code: ${res.status}`);
        }
        return res.text();
      })
      .catch((e: Error) => {
        throw new Error(`Failed to get tip block hash: ${e.message}`);
      });
    return Number(tipHeight)
  }

  private async _getConfirmations(txid: string): Promise<
    | {
        blockhash: string;
        confirmations: number;
      }
    | Error
  > {
    const tipHeight = await this._getTipHeight()
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
          if (data['error']) {
            throw new Error(data['error'])
          }
          return {
            blockhash: data['block_hash'],
            confirmations: data['confirmed'] ? tipHeight - data['block_height'] + 1 : -1,
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

  async broadcast(txHex: string): Promise<TxId> {
    const res = await this._broadcast(txHex);
    if (res instanceof Error) {
      throw res;
    }
    this.broadcastedTxs.set(res, txHex);
    return res;
  }

  async broadcastPsbt(psbtBase64: string, metadata?: Record<string, unknown>): Promise<TxId> {
    const psbt = ExtPsbt.fromBase64(psbtBase64);
    const txHex = psbt.extractTransaction().toHex();
    return this.broadcast(txHex);
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

  async getMedianTime(): Promise<number> {
    // First get the tip block hash
    const tipHashUrl = `${this.getMempoolApiHost()}/api/blocks/tip/hash`;
    const tipHash = await fetch(tipHashUrl, {})
      .then((res) => {
        if (res.status !== 200) {
          throw new Error(`invalid http response code: ${res.status}`);
        }
        return res.text();
      })
      .catch((e: Error) => {
        throw new Error(`Failed to get tip block hash: ${e.message}`);
      });

    // Then get the block data to extract mediantime
    const blockUrl = `${this.getMempoolApiHost()}/api/block/${tipHash}`;
    return fetch(blockUrl, {})
      .then((res) => {
        if (res.status !== 200) {
          throw new Error(`invalid http response code: ${res.status}`);
        }
        const contentType = res.headers.get('content-type');
        if (contentType.includes('json')) {
          return res.json();
        } else {
          throw new Error(`invalid http content type: ${contentType}`);
        }
      })
      .then((blockData: any) => {
        if (typeof blockData.mediantime !== 'number') {
          throw new Error(`Invalid block data: mediantime not found`);
        }
        return blockData.mediantime;
      })
      .catch((e: Error) => {
        throw new Error(`Failed to get median time: ${e.message}`);
      });
  }
}
