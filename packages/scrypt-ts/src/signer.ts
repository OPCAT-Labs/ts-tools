/**
 * signPsbt options
 * @category Signer
 */
export interface SignOptions {
  /** whether finalize psbt after signing, default is true */
  autoFinalized: boolean;
  /**  */
  toSignInputs: ToSignInput[];
}

/**
 * signPsbt input options
 * @category Signer
 */
export interface ToSignInput {
  /**  which input to sign  */
  index: number;
  /** which address corresponding private key to use for signing  */
  address?: string;
  /** which publicKey corresponding private key to use for signing  */
  publicKey?: string;
  /** tapLeafHashToSign */
  tapLeafHashToSign?: string;
  /** sighashTypes */
  sighashTypes?: number[];
}

type HexString = string;

/**
 * A `Signer` is a interface which in some way directly or indirectly has access to a private key, which can sign messages and transactions to authorize the network to perform operations.
 * @category Signer
 */
export interface Signer {
  /** Get address of current signer.  */
  getAddress(): Promise<string>;
  /** Get publicKey of current signer. */
  getPublicKey(): Promise<HexString>;
  /** traverse all inputs that match the current address to sign. */
  signPsbt(psbtHex: HexString, options?: SignOptions): Promise<HexString>;
  /** same as signPsbt, but sign multiple PSBTs at once. */
  signPsbts(reqs: { psbtHex: HexString; options?: SignOptions }[]): Promise<HexString[]>;
}
