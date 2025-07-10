
import {  hexToUint8Array } from '../utils/common.js';
import { SignOptions, Signer } from '../signer.js';
import { DEFAULT_NETWORK } from '../utils/constants.js';
import { PrivateKey, crypto, Network} from '@opcat-labs/opcat';
import { fromSupportedNetwork } from '../networks.js';
import { Psbt, Signer as PSigner } from '../psbt/psbt.js';

export class PsbtSigner implements PSigner {
  constructor(private readonly privateKey: PrivateKey) {

  } 

  get publicKey(): Uint8Array {
    return hexToUint8Array(this.privateKey.toPublicKey().toHex());
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  get network(): Network {
    return this.privateKey.network;
  }


  sign(hash: Uint8Array, _lowR?: boolean): Uint8Array {
    return crypto.ECDSA.sign(Buffer.from(hash), this.privateKey, 'little').toBuffer();
  }
  getPublicKey?(): Uint8Array {
    return this.publicKey;
  }
}
/**
 * An implemention of a simple signer which should just be used in nodejs environments.
 * @category Signer
 */
export class DefaultSigner implements Signer {

  private readonly keyPair: PsbtSigner;
  public readonly network: Network;
  constructor(
    private readonly privateKey: PrivateKey = PrivateKey.fromRandom(fromSupportedNetwork(DEFAULT_NETWORK)),

  ) {
    this.keyPair = new PsbtSigner(privateKey);
    this.network = this.privateKey.network;
  }

  /**
   * Gets the address derived from the signer's private key and network.
   * @returns A promise resolving to the address string.
   */
  async getAddress(): Promise<string> {
    return Promise.resolve(
      this.privateKey.toPublicKey().toAddress(this.network).toString(),
    );
  }

  /**
   * Returns the public key in hexadecimal format derived from the private key.
   * @returns A promise that resolves to the public key as a hex string.
   */
  async getPublicKey(): Promise<string> {
    return Promise.resolve(this.privateKey.toPublicKey().toHex());
  }

  /**
   * Signs a PSBT (Partially Signed Bitcoin Transaction) with the signer's key pair.
   * 
   * @param psbtHex - The PSBT in hexadecimal format to be signed
   * @param options - Optional signing configuration including inputs to sign
   * @returns Promise resolving to the signed PSBT in hexadecimal format
   * 
   * @remarks
   * - If options are provided, only specified inputs matching the signer's address/public key will be signed
   * - If no options are provided, all inputs will be signed with SIGHASH_ALL
   */
  async signPsbt(psbtHex: string, options?: SignOptions): Promise<string> {
    const psbt = Psbt.fromHex(psbtHex);


    const address = await this.getAddress();
    const publicKey = await this.getPublicKey();
    if (options) {
      options.toSignInputs.forEach((inputOpt) => {
        if (inputOpt.address && inputOpt.address !== address) {
          return;
        }

        if (inputOpt.publicKey && inputOpt.publicKey !== publicKey) {
          return;
        }

        const sighashTypes = inputOpt.sighashTypes || [crypto.Signature.SIGHASH_ALL];
        psbt.signInput(inputOpt.index, this.keyPair, sighashTypes);
      });
    } else {
      psbt.data.inputs.forEach((_, inputIdx) => {
        psbt.signInput(inputIdx, this.keyPair, [crypto.Signature.SIGHASH_ALL]);
      });
    }
    return Promise.resolve(psbt.toHex());
  }
  /**
   * Signs multiple PSBTs (Partially Signed Bitcoin Transactions) in parallel.
   * @param reqs Array of objects containing PSBT hex strings and optional signing options
   * @returns Promise resolving to an array of signed PSBT hex strings
   */
  signPsbts(reqs: { psbtHex: string; options?: SignOptions }[]): Promise<string[]> {
    return Promise.all(reqs.map((req) => this.signPsbt(req.psbtHex, req.options)));
  }

}
