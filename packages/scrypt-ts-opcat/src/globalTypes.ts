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
}
/** All Networks Supported by the SDK */
export type SupportedNetwork = 'btc-signet' | 'fractal-mainnet' | 'fractal-testnet';

/**
 * @ignore
 * Witness data in a blockchain transaction contains the cryptographic proofs (like signatures) that validate the spender's authority to use the funds."
 */
export type Witness = Uint8Array[];

/** @ignore */
export type TapScript = string;

/** @ignore */
export interface Taprootable {
  /** TapScript */
  tapScript: TapScript;
  /** Control Block */
  controlBlock: string;
  /** Tweaked Pubkey */
  tweakedPubkey: string;
  /**
   * Update the properties to join the TapTree as a TapLeaf.
   * @param tapTree the tapTree which this TapLeaf belongs to.
   */
  asTapLeaf(tapTree: TapScript[], tPubkey: string): void;
}

export type InputIndex = number;

export type OutputIndex = number;

export type TxId = string;
