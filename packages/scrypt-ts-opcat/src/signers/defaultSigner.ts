
import {  hexToUint8Array } from '../utils/common.js';
import { SignOptions, Signer } from '../signer.js';
import { SupportedNetwork } from '../globalTypes.js';
import { DEFAULT_NETWORK } from '../utils/constants.js';
import { PrivateKey, crypto} from '@opcat-labs/opcat';
import { fromSupportedNetwork, Network } from '../networks.js';
import { Psbt, Signer as PSigner } from '../psbt/psbt.js';

export class PsbtSigner implements PSigner {
  constructor(private readonly privateKey: PrivateKey) {

  } 

  get publicKey(): Uint8Array {
    return hexToUint8Array(this.privateKey.toPublicKey().toHex());
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  get network(): any {
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

  async getAddress(): Promise<string> {
    return Promise.resolve(
      this.privateKey.toPublicKey().toAddress(this.network).toString(),
    );
  }

  async getPublicKey(): Promise<string> {
    return Promise.resolve(this.privateKey.toPublicKey().toHex());
  }

  async signPsbt(psbtHex: string, options?: SignOptions): Promise<string> {
    const psbt = Psbt.fromHex(psbtHex);


    const address = await this.getAddress();
    if (options) {
      options.toSignInputs.forEach((inputOpt) => {
        if (inputOpt.address && inputOpt.address !== address) {
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
  signPsbts(reqs: { psbtHex: string; options?: SignOptions }[]): Promise<string[]> {
    return Promise.all(reqs.map((req) => this.signPsbt(req.psbtHex, req.options)));
  }

}
