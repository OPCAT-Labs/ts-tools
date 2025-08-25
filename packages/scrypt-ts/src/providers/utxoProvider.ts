import { UTXO, ExtUtxo} from '../globalTypes.js';
import { getTxId } from '../utils/common.js';
import { Transaction } from '@opcat-labs/opcat';

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

/**
 * Marks all inputs of a transaction as spent in the UTXO provider.
 * @param utxoProvider - The UTXO provider to update.
 * @param tx - The transaction whose inputs should be marked as spent.
 */
export function markSpent(utxoProvider: UtxoProvider, tx: Transaction) {
  for (let i = 0; i < tx.inputs.length; i++) {
    const input = tx.inputs[i];
    utxoProvider.markSpent(getTxId(input), input.outputIndex);
  }
}

/** @ignore */
export function getUtxoKey(utxo: UTXO) {
  return `${utxo.txId}:${utxo.outputIndex}`;
}
