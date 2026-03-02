import { SignOptions, Signer } from '../signer.js';

interface Window {
  X: number;
  scrollY: number;
}

declare const window: Window & typeof globalThis;

type HexString = string;

/**
 * Unisat wallet api, see [opcat api docs]{@link https://docs.opcat.io/dev/opcat-developer-center/opcat-wallet#opcat-wallet-api}
 * @category Signer
 */
export interface OpcatAPI {
  getAccounts: () => Promise<string[]>;
  requestAccounts: () => Promise<string[]>;
  getPublicKey: () => Promise<string>;
  signPsbt(psbtHex: HexString, options?: SignOptions): Promise<HexString>;
  signPsbts(psbtHexs: HexString[], options?: SignOptions[]): Promise<HexString[]>;
}

/**
 * a [signer]{@link https://docs.opcatlabs.io/how-to-deploy-and-call-a-contract/#signer } which implemented the protocol with the [Unisat wallet]{@link https://opcat.io},
 * and dapps can use to interact with the Unisat wallet
 * @category Signer
 */
export class WalletSigner implements Signer {
  private _opcat: OpcatAPI;

  constructor(opcat: OpcatAPI) {
    this._opcat = opcat;
  }

  /**
   * Retrieves the Unisat API instance from either the cached property or global window object.
   * @throws {Error} If Unisat API is not available (not installed).
   * @returns {OpcatAPI} The Unisat API instance.
   */
  getOpcatAPI(): OpcatAPI {
    const opcat = this._opcat || window['opcat'];
    if (typeof opcat === 'undefined') {
      throw new Error('opcat wallet not install!');
    }

    return opcat;
  }

  /**
   * Gets the address from the Unisat wallet API.
   * @returns A promise that resolves to the first account address string.
   */
  async getAddress(): Promise<string> {
    const accounts = await this.getOpcatAPI().getAccounts();
    return accounts[0];
  }

  /**
   * Retrieves the public key from the Unisat wallet API.
   * @returns A promise that resolves to the public key as a string.
   */
  async getPublicKey(): Promise<string> {
    return this.getOpcatAPI().getPublicKey();
  }

  /**
   * Signs a PSBT (Partially Signed Opcat Transaction) using the Unisat wallet API.
   * 
   * @param psbtHex - The PSBT in hexadecimal format to be signed.
   * @param options - Optional signing options (e.g., specific inputs to sign).
   * @returns A Promise resolving to the signed PSBT in hexadecimal format.
   */
  async signPsbt(psbtHex: string, options?: SignOptions): Promise<string> {
    return this.getOpcatAPI().signPsbt(psbtHex, options);
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
    return this.getOpcatAPI().signPsbts(
      reqs.map((req) => req.psbtHex),
      options,
    );
  }
}
