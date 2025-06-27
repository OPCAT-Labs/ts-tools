/** @ignore */
export interface Flavoring<FlavorT> {
  _type?: FlavorT;
}

/** @ignore */
export type Flavor<T, FlavorT> = T & Flavoring<FlavorT>;

/** @ignore */
export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<T>;

/** @ignore */

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

export type InputIndex = number;

export type OutputIndex = number;

export type TxId = string;




export type B2GProvable = {

  /**
   * The preimage of the tx to which the UTXO belongs.
   * Note that the witness data part is not neccessary.
   */
  txHashPreimage: string;
};

export type B2GUTXO = UTXO & B2GProvable;

export type ExtUtxo = UTXO & Partial<B2GUTXO>;