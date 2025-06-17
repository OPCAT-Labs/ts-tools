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
export type SupportedNetwork = 'fractal-mainnet' | 'fractal-testnet' | 'fractal-regtest';

/**
 * @ignore
 * Witness data in a blockchain transaction contains the cryptographic proofs (like signatures) that validate the spender's authority to use the funds."
 */
export type RawArgs = Uint8Array[];


export type InputIndex = number;

export type OutputIndex = number;

export type TxId = string;




export type StateProvable = {
  /**
   * The state hashes of all the outputs of the transaction to which the UTXO belongs.
   */
  txoStateHashes: string;

  /**
   * The preimage of the tx to which the UTXO belongs.
   * Note that the witness data part is not neccessary.
   */
  txHashPreimage: string;
};

export type StateProvableUtxo = UTXO & StateProvable;

export type ExtUtxo = UTXO & Partial<StateProvable>;

export type StatefulContractUtxo = StateProvableUtxo;