import { Transaction } from '@scrypt-inc/bitcoinjs-lib';
import { UTXO } from '../globalTypes.js';
import { ExtUtxo } from '../covenant.js';
import { getTxId } from '../utils/common.js';

/**
 * The optional conditions for querying UTXO.
 * @category Provider
 */
export interface UtxoQueryOptions {
  unspentValue: number;
  estimateSize: number;
  feePerKb: number;

  /* For each additional UTXO, the additional size */
  additional?: number;
  stateProvable?: boolean;
}

/**
 * a Provider used to query UTXO related to the address
 * @category Provider
 */
export interface UtxoProvider {
  /**
   * Get a list of the UTXOs.
   * @param address The address of the returned UTXOs belongs to.
   * @param options The optional query conditions, see details in `UtxoQueryOptions`.
   * @returns  A promise which resolves to a list of UTXO for the query options.
   */
  getUtxos(address: string, options?: UtxoQueryOptions): Promise<ExtUtxo[]>;
  /**
   * Mark an outpoint as spent
   * @param txId
   * @param vout
   */
  markSpent(txId: string, vout: number): void;
  /**
   * Add a UTXO to the provider
   * @param txId
   * @param vout
   */
  addNewUTXO(utxo: UTXO): void;
}

/** @ignore */
export function markSpent(utxoProvider: UtxoProvider, tx: Transaction) {
  for (let i = 0; i < tx.ins.length; i++) {
    const input = tx.ins[i];
    utxoProvider.markSpent(getTxId(input), input.index);
  }
}

/** @ignore */
export function getUtxoKey(utxo: UTXO) {
  return `${utxo.txId}:${utxo.outputIndex}`;
}
