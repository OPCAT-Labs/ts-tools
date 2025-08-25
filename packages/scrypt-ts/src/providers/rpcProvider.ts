/* eslint-disable @typescript-eslint/no-explicit-any */
import Decimal from 'decimal.js';
import { ChainProvider } from './chainProvider.js';
import { UtxoProvider, UtxoQueryOptions, getUtxoKey } from './utxoProvider.js';
import { SupportedNetwork, UTXO } from '../globalTypes.js';
import * as tools from 'uint8array-tools';
import { duplicateFilter } from '../utils/common.js';
/**
 * The RPCProvider is backed by opcat RPC
 * @category Provider
 */
export class RPCProvider implements ChainProvider, UtxoProvider {
  private broadcastedTxs: Map<string, string> = new Map();
  private spentUTXOs = new Set<string>();

  private newUTXOs = new Map<string, UTXO>();

  constructor(
    public readonly network: SupportedNetwork,
    public readonly url: string,
    public readonly walletName: string,
    public readonly username: string,
    public readonly password: string,
  ) {}

  async getNetwork(): Promise<SupportedNetwork> {
    return this.network;
  }
  
  getFeeRate(): Promise<number> {
    const Authorization = `Basic ${tools.toBase64(
      tools.fromUtf8(`${this.getRpcUser()}:${this.getRpcPassword()}`),
    )}`;

    return fetch(this.getRpcUrl(null), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization,
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'cat-cli',
        method: 'estimatesmartfee',
        params: [1],
      }),
    })
      .then((res) => {
        const contentType = res.headers.get('content-type');
        if (contentType.includes('json')) {
          return res.json();
        } else {
          throw new Error(`invalid http content type : ${contentType}, status: ${res.status}`);
        }
      })
      .then((res: any) => {
        if (res.result === null || (res.result.errors && res.result.errors.length > 0)) {
          throw new Error(JSON.stringify(res));
        }
        const feerate = new Decimal(res.result.feerate)
          .mul(new Decimal(100000000))
          .div(new Decimal(1000))
          .toNumber();
        return Math.ceil(feerate);
      })
      .catch((e: Error) => {
        return 1;
      });
  }

  protected getRpcUser = () => {
    return this.username;
  };
  protected getRpcPassword = () => {
    return this.password;
  };
  protected getRpcUrl = (walletName: string) => {
    return walletName === null ? this.url : `${this.url}/wallet/${walletName}`;
  };

  async getConfirmations(txId: string): Promise<number> {
    const res = await this._getConfirmations(txId);
    if (res instanceof Error) {
      throw new Error(`getConfirmations failed, ${res.message}`);
    }

    return res.confirmations;
  }

  private async _broadcast(txHex: string): Promise<string | Error> {
    const Authorization = `Basic ${tools.toBase64(
      tools.fromUtf8(`${this.getRpcUser()}:${this.getRpcPassword()}`),
    )}`;

    return fetch(this.getRpcUrl(null), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization,
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'cat-cli',
        method: 'sendrawtransaction',
        params: [txHex],
      }),
    })
      .then((res) => {
        const contentType = res.headers.get('content-type');
        if (contentType.includes('json')) {
          return res.json();
        } else {
          throw new Error(`invalid http content type : ${contentType}, status: ${res.status}`);
        }
      })
      .then((res: any) => {
        if (res.result === null) {
          throw new Error(JSON.stringify(res));
        }
        return res.result;
      })
      .catch((e) => {
        console.error('sendrawtransaction error:', e);
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
    const Authorization = `Basic ${tools.toBase64(
      tools.fromUtf8(`${this.getRpcUser()}:${this.getRpcPassword()}`),
    )}`;

    return fetch(this.getRpcUrl(null), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization,
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'cat-cli',
        method: 'getrawtransaction',
        params: [txid, true],
      }),
    })
      .then((res) => {
        const contentType = res.headers.get('content-type');
        if (contentType.includes('json')) {
          return res.json();
        } else {
          throw new Error(`invalid http content type : ${contentType}, status: ${res.status}`);
        }
      })
      .then((res: any) => {
        if (res.result === null) {
          throw new Error(JSON.stringify(res));
        }
        return {
          confirmations: -1,
          blockhash: '',
          ...res.result,
        };
      })
      .catch((e) => {
        console.error('getConfirmations error:', e);
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
        throw new Error(`Can not find the tx with id ${txId}, please broadcast it first`);
      }
      txHex = res;
    }
    return txHex;
  }

  private async _getRawTransaction(txid: string): Promise<string | Error> {
    const Authorization = `Basic ${tools.toBase64(
      tools.fromUtf8(`${this.getRpcUser()}:${this.getRpcPassword()}`),
    )}`;

    return fetch(this.getRpcUrl(null), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization,
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'cat-cli',
        method: 'getrawtransaction',
        params: [txid],
      }),
    })
      .then((res) => {
        const contentType = res.headers.get('content-type');
        if (contentType.includes('json')) {
          return res.json();
        } else {
          throw new Error(`invalid http content type : ${contentType}, status: ${res.status}`);
        }
      })
      .then((res: any) => {
        if (res.result === null) {
          throw new Error(JSON.stringify(res));
        }
        return res.result;
      })
      .catch((e) => {
        return e;
      });
  }

  async getUtxos(address: string, _options?: UtxoQueryOptions): Promise<UTXO[]> {
    const Authorization = `Basic ${tools.toBase64(
      tools.fromUtf8(`${this.getRpcUser()}:${this.getRpcPassword()}`),
    )}`;

    const utxos = await fetch(this.getRpcUrl(this.walletName), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization,
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'cat-cli',
        method: 'listunspent',
        params: [0, 9999999, [address]],
      }),
    })
      .then((res) => {
        if (res.status === 200) {
          return res.json();
        }
        throw new Error(res.statusText);
      })
      .then((res: any) => {
        if (res.result === null) {
          throw new Error(JSON.stringify(res));
        }

        const utxos: UTXO[] = res.result.map((item: any) => {
          return {
            txId: item.txid,
            outputIndex: item.vout,
            script: item.scriptPubKey,
            satoshis: new Decimal(item.amount).mul(new Decimal(100000000)).toNumber(),
            data: item.data
          }
        });

        return utxos;
      })
      .catch((e: Error) => {
        console.error('listunspent error:', e);
        return [];
      });

    return utxos
      .concat(Array.from(this.newUTXOs.values()))
      .filter((utxo) => this.isUnSpent(utxo.txId, utxo.outputIndex))
      .filter(duplicateFilter((utxo) => `${utxo.txId}:${utxo.outputIndex}`))
      .sort((a, b) => a.satoshi - b.satoshi);
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
}
