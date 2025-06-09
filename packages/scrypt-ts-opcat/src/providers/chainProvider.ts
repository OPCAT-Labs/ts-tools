import { TxId } from '../globalTypes.js';

/**
 * a provider for interacting with the blockchain
 * @category Provider
 */
export interface ChainProvider {
  /**
   * Send a raw transaction hex string.
   * @param rawTxHex The raw transaction hex string to send.
   * @returns A promise which resolves to the hash of the transaction that has been sent.
   */
  broadcast(txHex: string): Promise<TxId>;
  /**
   * Get a transaction raw hex from the network.
   * @param txHash The hash value of the transaction.
   * @returns The query result with the transaction raw hex.
   */
  getRawTransaction(txId: TxId): Promise<string>;
  /**
   * Query a transaction confirmation
   * @param txId
   */
  getConfirmations(txId: TxId): Promise<number>;
  /**
   * Query current network fee
   * @param txId
   */
  getFeeRate(): Promise<number>;
}
