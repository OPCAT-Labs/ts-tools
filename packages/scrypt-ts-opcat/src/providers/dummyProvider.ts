import { SupportedNetwork, TxId, UTXO } from '../globalTypes.js';
import { ChainProvider } from './chainProvider.js';
import { UtxoProvider, UtxoQueryOptions, getUtxoKey } from './utxoProvider.js';
import * as utils from '@noble/hashes/utils';
import { Script, Transaction } from '@opcat-labs/opcat';
import { ExtPsbt } from '../psbt/extPsbt.js';

/**
 * A DummyProvider is build for test purpose only, it always returns a dummy utxo for `getUtxos` request.
 * @category Provider
 */
export class DummyProvider implements ChainProvider, UtxoProvider {
  private broadcastedTxs: Map<string, string> = new Map();
  private spentUTXOs = new Set<string>();

  private newUTXOs = new Map<string, UTXO>();

  constructor(private readonly network: SupportedNetwork = 'opcat-mainnet') {
  }
  async getNetwork(): Promise<SupportedNetwork> {
    return this.network;
  }
  async getUtxos(address: string, _options?: UtxoQueryOptions): Promise<UTXO[]> {
    const script = Script.fromAddress(address)

    const dummyTx = new Transaction();
    dummyTx.addInput(new Transaction.Input({
      prevTxId: Buffer.from(utils.randomBytes(32)),
      outputIndex: 0,
      script: Script.empty(),
      sequenceNumber: 0xffffffff,
      output: new Transaction.Output({
        script: script,
        satoshis: 2147483647, // 2**31 - 1
        data: '',
      })
    }))
    dummyTx.addOutput(new Transaction.Output({
      script: script,
      satoshis: 210000000, 
      data: '',
    }))

    this.broadcastedTxs.set(dummyTx.id, dummyTx.toHex());

    return Promise.resolve([
      {
        txId: dummyTx.id,
        outputIndex: 0,
        script: dummyTx.outputs[0].script.toHex(),
        satoshis: dummyTx.outputs[0].satoshis,
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
  async broadcast(txHex: string): Promise<TxId> {
    const tx = Transaction.fromString(txHex);
    this.broadcastedTxs.set(tx.id, txHex);
    return tx.id;
  }

  async broadcastPsbt(psbtBase64: string, metadata?: Record<string, unknown>): Promise<TxId> {
    const psbt = ExtPsbt.fromBase64(psbtBase64);
    const txHex = psbt.extractTransaction().toHex();
    return this.broadcast(txHex);
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

  async getMedianTime(): Promise<number> {
    // Return current timestamp minus 10 minutes (600 seconds)
    return Math.floor(Date.now() / 1000) - 600;
  }
}
