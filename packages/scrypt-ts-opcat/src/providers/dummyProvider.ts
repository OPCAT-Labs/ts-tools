import { SupportedNetwork, UTXO } from '../globalTypes.js';
import { ChainProvider } from './chainProvider.js';
import { UtxoProvider, UtxoQueryOptions, getUtxoKey } from './utxoProvider.js';
import { uint8ArrayToHex } from '../utils/common.js';
import * as utils from '@noble/hashes/utils';
import { Script, Transaction } from '@opcat-labs/opcat';

/**
 * A DummyProvider is build for test purpose only, it always returns a dummy utxo for `getUtxos` request.
 * @category Provider
 */
export class DummyProvider implements ChainProvider, UtxoProvider {
  private broadcastedTxs: Map<string, string> = new Map();
  private spentUTXOs = new Set<string>();

  private newUTXOs = new Map<string, UTXO>();

  constructor() {}
  async getNetwork(): Promise<SupportedNetwork> {
    return 'fractal-mainnet';
  }
  async getUtxos(address: string, _options?: UtxoQueryOptions): Promise<UTXO[]> {
    const script = Script.fromAddress(address)

    return Promise.resolve([
      {
        txId: uint8ArrayToHex(utils.randomBytes(32)),
        outputIndex: 0,
        script: script.toHex(),
        satoshis: 2147483647, // 2**31 - 1
        data: '',
      },
    ]);
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
    return Promise.resolve(1);
  }
  async getConfirmations(_txId: string): Promise<number> {
    return Promise.resolve(1);
  }
  async broadcast(txHex: string): Promise<string> {
    const tx = Transaction.fromString(txHex);
    this.broadcastedTxs.set(tx.id, txHex);
    return tx.id;
  }

  async getRawTransaction(txId: string): Promise<string> {
    const txHex = this.broadcastedTxs.get(txId);
    if (!txHex) {
      throw new Error(
        `Can not find the tx with id ${txId}, please broadcast it by using the TestProvider first`,
      );
    }
    return txHex;
  }
}
