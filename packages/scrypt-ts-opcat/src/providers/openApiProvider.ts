import { SupportedNetwork, TxId, UTXO } from '../globalTypes.js';
import { ChainProvider } from './chainProvider.js';
import fetch from 'cross-fetch';
import { UtxoProvider, UtxoQueryOptions, getUtxoKey } from './utxoProvider.js';
import { uint8ArrayToHex, duplicateFilter } from '../utils/common.js';
import { Script } from '@opcat-labs/opcat';
import { ExtPsbt } from '../psbt/extPsbt.js';

/**
 * The OpenApiProvider is backed by [OP_CAT Layer OpenAPI]{@link https://openapi.opcatlabs.io}
 * @category Provider
 */
export class OpenApiProvider implements ChainProvider, UtxoProvider {
  private broadcastedTxs: Map<string, string> = new Map();
  private spentUTXOs = new Set<string>();

  private newUTXOs = new Map<string, UTXO>();
  private apiBaseUrl: string;

  constructor(
    public readonly network: SupportedNetwork,
    private readonly options?: {
      apiBaseUrl: string;
    }
  ) {

    let apiBaseUrl: string;
    if (this.network === 'opcat-testnet') {
      apiBaseUrl = 'https://testnet-openapi.opcatlabs.io';
    } else if (this.network === 'opcat-mainnet') {
      apiBaseUrl = 'https://openapi.opcatlabs.io';
    } else {
      throw new Error(`Unsupported network: ${this.network}`)
    }
    if (options?.apiBaseUrl) {
      apiBaseUrl = options.apiBaseUrl
    }
    this.apiBaseUrl = apiBaseUrl
  }

  async getNetwork(): Promise<SupportedNetwork> {
    return this.network;
  }

  async getUtxos(address: string, _options?: UtxoQueryOptions): Promise<UTXO[]> {
    const script = uint8ArrayToHex(Script.fromAddress(address).toBuffer());

    const url = `${this.apiBaseUrl}/api/v1/address/${address}/utxos`;
    const requiredSat = _options?.unspentValue || 0; // 0 means fetch all utxos
    let totalUtxos: UTXO[] = [];

    const limit = 50;
    let after_txid: string;
    let after_vout: number;

    while(true) {
      const query = after_txid ? `?max_utxos=${limit}&after_txid=${after_txid}&after_vout=${after_vout}` : `?max_utxos=${limit}`;
      const resp = await fetch(url + query);
      const contentType = resp.headers.get('content-type');

      if (contentType?.includes('json')) {
        const res = await resp.json();

        // OpenAPI uses standard response envelope: {code, msg, data}
        if (res['code'] !== 0) {
          throw new Error(res['msg'] || 'Failed to fetch UTXOs');
        }

        const utxoData = res['data'] || [];
        const utxos: UTXO[] = utxoData.map((utxo: any) => ({
          txId: utxo.txid,
          outputIndex: utxo.vout,
          script: utxo.scriptPubKey || script,
          satoshis: utxo.value,
          data: utxo.data || ''
        }));

        totalUtxos = [...totalUtxos, ...utxos]
          .concat(Array.from(this.newUTXOs.values()))
          .filter((utxo) => this.isUnSpent(utxo.txId, utxo.outputIndex))
          .filter(duplicateFilter((utxo) => `${utxo.txId}:${utxo.outputIndex}`))
          .filter(utxo => utxo.script === script)
          .sort((a, b) => a.satoshis - b.satoshis);

        const lastUtxo = utxos.at(-1);
        if (lastUtxo) {
          after_txid = lastUtxo.txId;
          after_vout = lastUtxo.outputIndex;
        }

        if (utxos.length < limit) break;

        const totalSatoshis = totalUtxos.reduce((total, utxo) => total + utxo.satoshis, 0);
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

  async getFeeRate(): Promise<number> {
    const url = `${this.apiBaseUrl}/api/v1/fee-estimates`;
    try {
      const res = await fetch(url, {});
      const contentType = res.headers.get('content-type');

      let data;
      if (contentType?.includes('json')) {
        data = await res.json();
      } else {
        data = await res.text();
      }

      // OpenAPI returns {code, msg, data: {economyFee, ...}}
      if (data.code === 0 && data.data) {
        const feeRate = data.data.feerate;
        if (typeof feeRate !== 'number' || feeRate <= 0) {
          throw new Error('Invalid fee rate received from API');
        }
        return feeRate;
      }

      throw new Error(data.msg || 'Failed to fetch fee rate');
    } catch (e: any) {
      throw new Error(`Failed to get fee rate: ${e.message}`);
    }
  }

  async getConfirmations(txId: string): Promise<number> {
    const res = await this._getConfirmations(txId);
    if (res instanceof Error) {
      throw new Error(`getConfirmations failed, ${res.message}`);
    }

    return res.confirmations;
  }

  private async _broadcast(txHex: string): Promise<string | Error> {
    const url = `${this.apiBaseUrl}/api/v1/tx`;
    return fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain',
      },
      body: txHex,
    })
      .then(async (res) => {
        const contentType = res.headers.get('content-type');
        if (contentType?.includes('json')) {
          return res.json();
        } else {
          return res.text();
        }
      })
      .then(async (data) => {
        // OpenAPI returns {code, msg, data: txid}
        if (typeof data === 'object' && data.code === 0 && data.data) {
          return data.data;
        } else if (typeof data === 'string' && data.length === 64) {
          return data;
        } else if (typeof data === 'object') {
          throw new Error(data.msg || JSON.stringify(data));
        } else if (typeof data === 'string') {
          throw new Error(data);
        } else {
          throw new Error('unknown error');
        }
      })
      .catch((e) => {
        return e;
      });
  }

  private async _getTipHeight(): Promise<number> {
    const tipHeightUrl = `${this.apiBaseUrl}/api/v1/block/tip/height`;
    const result = await fetch(tipHeightUrl, {})
      .then((res) => {
        if (res.status !== 200) {
          throw new Error(`invalid http response code: ${res.status}`);
        }
        const contentType = res.headers.get('content-type');
        if (contentType?.includes('json')) {
          return res.json();
        } else {
          return res.text();
        }
      })
      .catch((e: Error) => {
        throw new Error(`Failed to get tip block height: ${e.message}`);
      });

    // OpenAPI returns {code, msg, data: height}
    if (typeof result === 'object' && result.code === 0) {
      return Number(result.data);
    } else if (typeof result === 'string') {
      return Number(result);
    }
    throw new Error('Invalid response format for tip height');
  }

  private async _getConfirmations(txid: string): Promise<
    | {
        blockhash: string;
        confirmations: number;
      }
    | Error
  > {
    const tipHeight = await this._getTipHeight();
    const url = `${this.apiBaseUrl}/api/v1/tx/${txid}/status`;
    return fetch(url, {})
      .then(async (res) => {
        const contentType = res.headers.get('content-type');
        if (contentType?.includes('json')) {
          return res.json();
        } else {
          return res.text();
        }
      })
      .then(async (data) => {
        if (typeof data === 'object') {
          if (data['code'] !== 0) {
            throw new Error(data['msg'] || 'Failed to get transaction status');
          }

          const statusData = data['data'];
          return {
            blockhash: statusData['block_hash'] || '',
            confirmations: statusData['confirmed'] ? tipHeight - statusData['blockHeight'] + 1 : -1,
          };
        } else if (typeof data === 'string') {
          throw new Error(data);
        } else {
          throw new Error('unknown error');
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
          `Can not find the tx with id ${txId}, please broadcast it by using the OpenApiProvider first`,
        );
      }
      txHex = res;
    }
    return txHex;
  }

  private async _getRawTransaction(txid: string): Promise<string | Error> {
    const url = `${this.apiBaseUrl}/api/v1/tx/${txid}/raw`;
    return fetch(url, {})
      .then((res) => {
        if (res.status !== 200) {
          throw new Error(`invalid http response code: ${res.status}`);
        }
        const contentType = res.headers.get('content-type');
        if (contentType?.includes('json')) {
          return res.json();
        } else {
          return res.text();
        }
      })
      .then((result: any) => {
        // OpenAPI returns {code, msg, data: raw_hex}
        if (typeof result === 'object' && result.code === 0 && result.data) {
          // Trim whitespace (including newlines) from the raw transaction hex
          return result.data.trim();
        } else if (typeof result === 'string') {
          return result.trim();
        }
        throw new Error('Invalid response format for raw transaction');
      })
      .catch((e: Error) => {
        return e;
      });
  }

  async getMedianTime(): Promise<number> {
    // First get the tip block hash
    const tipHashUrl = `${this.apiBaseUrl}/api/v1/block/tip/hash`;
    const tipHashResult = await fetch(tipHashUrl, {})
      .then((res) => {
        if (res.status !== 200) {
          throw new Error(`invalid http response code: ${res.status}`);
        }
        const contentType = res.headers.get('content-type');
        if (contentType?.includes('json')) {
          return res.json();
        } else {
          return res.text();
        }
      })
      .catch((e: Error) => {
        throw new Error(`Failed to get tip block hash: ${e.message}`);
      });

    // OpenAPI returns {code, msg, data: hash}
    let tipHash: string;
    if (typeof tipHashResult === 'object' && tipHashResult.code === 0) {
      tipHash = tipHashResult.data;
    } else if (typeof tipHashResult === 'string') {
      tipHash = tipHashResult;
    } else {
      throw new Error('Invalid response format for tip hash');
    }

    // Then get the block data to extract mediantime
    const blockUrl = `${this.apiBaseUrl}/api/v1/block/${tipHash}`;
    return fetch(blockUrl, {})
      .then((res) => {
        if (res.status !== 200) {
          throw new Error(`invalid http response code: ${res.status}`);
        }
        const contentType = res.headers.get('content-type');
        if (contentType?.includes('json')) {
          return res.json();
        } else {
          throw new Error(`invalid http content type: ${contentType}`);
        }
      })
      .then((result: any) => {
        // OpenAPI returns {code, msg, data: blockData}
        if (result.code === 0 && result.data) {
          const blockData = result.data;
          // Only accept mediantime, not timestamp
          // mediantime is the median of the last 11 block timestamps and is used for BIP113 timelocks
          // Using timestamp instead would be incorrect for consensus-critical operations
          if (typeof blockData.mediantime !== 'number') {
            throw new Error(`Invalid block data: mediantime not found. API must provide mediantime for consensus-critical operations.`);
          }
          return blockData.mediantime;
        }
        throw new Error('Invalid response format for block data');
      })
      .catch((e: Error) => {
        throw new Error(`Failed to get median time: ${e.message}`);
      });
  }
}