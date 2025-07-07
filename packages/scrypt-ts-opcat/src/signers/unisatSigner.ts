import { SignOptions, Signer } from '../signer.js';

interface Window {
  X: number;
  scrollY: number;
}

declare const window: Window & typeof globalThis;

type HexString = string;

/**
 * Unisat wallet api, see [unisat api docs]{@link https://docs.unisat.io/dev/unisat-developer-center/unisat-wallet#unisat-wallet-api}
 * @category Signer
 */
export interface UnisatAPI {
  getAccounts: () => Promise<string[]>;
  requestAccounts: () => Promise<string[]>;
  getPublicKey: () => Promise<string>;
  signPsbt(psbtHex: HexString, options?: SignOptions): Promise<HexString>;
  signPsbts(psbtHexs: HexString[], options?: SignOptions[]): Promise<HexString[]>;
}

/**
 * a [signer]{@link https://docs.scrypt.io/btc-docs/how-to-deploy-and-call-a-contract/#signer } which implemented the protocol with the [Unisat wallet]{@link https://unisat.io},
 * and dapps can use to interact with the Unisat wallet
 * @category Signer
 */
export class UnisatSigner implements Signer {
  private _unisat: UnisatAPI;

  constructor(unisat: UnisatAPI) {
    this._unisat = unisat;
  }

  /**
   * Retrieves the Unisat API instance from either the cached property or global window object.
   * @throws {Error} If Unisat API is not available (not installed).
   * @returns {UnisatAPI} The Unisat API instance.
   */
  getUnisatAPI(): UnisatAPI {
    const unisat = this._unisat || window['unisat'];
    if (typeof unisat === 'undefined') {
      throw new Error('unisat not install!');
    }

    return unisat;
  }

  /**
   * Gets the address from the Unisat wallet API.
   * @returns A promise that resolves to the first account address string.
   */
  async getAddress(): Promise<string> {
    const accounts = await this.getUnisatAPI().getAccounts();
    return accounts[0];
  }

  /**
   * Retrieves the public key from the Unisat wallet API.
   * @returns A promise that resolves to the public key as a string.
   */
  async getPublicKey(): Promise<string> {
    return this.getUnisatAPI().getPublicKey();
  }

  /**
   * Signs a PSBT (Partially Signed Opcat Transaction) using the Unisat wallet API.
   * 
   * @param psbtHex - The PSBT in hexadecimal format to be signed.
   * @param options - Optional signing options (e.g., specific inputs to sign).
   * @returns A Promise resolving to the signed PSBT in hexadecimal format.
   */
  async signPsbt(psbtHex: string, options?: SignOptions): Promise<string> {
    return this.getUnisatAPI().signPsbt(psbtHex, options);
  }

  /**
   * Signs multiple PSBTs (Partially Signed Opcat Transactions) using the Unisat wallet API.
   * 
   * @param reqs - Array of objects containing PSBT hex strings and optional signing options
   * @returns Promise resolving to an array of signed PSBT hex strings
   */
  signPsbts(reqs: { psbtHex: string; options?: SignOptions }[]): Promise<string[]> {
    const options: SignOptions[] = reqs
      .filter((option) => typeof option === 'object')
      .map((req) => req.options as SignOptions);
    return this.getUnisatAPI().signPsbts(
      reqs.map((req) => req.psbtHex),
      options,
    );
  }
}
