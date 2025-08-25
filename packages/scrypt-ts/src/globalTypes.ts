/** @ignore */
export interface Flavoring<FlavorT> {
  _type?: FlavorT;
}

/** @ignore */
export type Flavor<T, FlavorT> = T & Flavoring<FlavorT>;

/** @ignore */
export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<T>;



/**
 * Represents an Unspent Transaction Output (UTXO) in a blockchain.
 * @property {string} [address] - The address associated with this UTXO (optional).
 * @property {string} txId - The transaction ID where this UTXO was created.
 * @property {number} outputIndex - The index of this output in the transaction.
 * @property {string} script - The locking script (ScriptPubKey) for this UTXO.
 * @property {number} satoshis - The amount of satoshis in this UTXO.
 * @property {string} data - Additional data associated with this UTXO.
 */
export interface UTXO {
  address?: string;
  txId: string;
  outputIndex: number;
  script: string;
  satoshis: number;
  data: string;
}
/** All Networks Supported by the SDK */
export type SupportedNetwork = 'opcat-mainnet' | 'opcat-testnet' | 'opcat-regtest';

/**
 * Represents the index of an input in a transaction.
 */
export type InputIndex = number;

/**
 * Represents the index of an output in a transaction.
 */
export type OutputIndex = number;

/**
 * Represents a transaction ID as a string type.
 */
export type TxId = string;


/**
 * Represents a provable B2G transaction component.
 * Contains the preimage of the transaction hash for UTXO verification.
 */
export type B2GProvable = {
  txHashPreimage: string;
};

/**
 * Represents a Bitcoin to Group UTXO (Unspent Transaction Output) type,
 * combining standard UTXO properties with B2G capabilities.
 */
export type B2GUTXO = UTXO & B2GProvable;

/**
 * Represents an extended UTXO (Unspent Transaction Output) that combines standard UTXO properties
 * with optional B2G capabilities.
 */
export type ExtUtxo = UTXO & Partial<B2GUTXO>;