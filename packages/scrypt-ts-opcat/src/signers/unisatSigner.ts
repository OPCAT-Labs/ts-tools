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

  getUnisatAPI(): UnisatAPI {
    const unisat = this._unisat || window['unisat'];
    if (typeof unisat === 'undefined') {
      throw new Error('unisat not install!');
    }

    return unisat;
  }

  async getAddress(): Promise<string> {
    const accounts = await this.getUnisatAPI().getAccounts();
    return accounts[0];
  }

  async getPublicKey(): Promise<string> {
    return this.getUnisatAPI().getPublicKey();
  }

  async signPsbt(psbtHex: string, options?: SignOptions): Promise<string> {
    return this.getUnisatAPI().signPsbt(psbtHex, options);
  }

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
