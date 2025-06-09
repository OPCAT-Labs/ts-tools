import * as ecc from '@bitcoinerlab/secp256k1';
import ECPairFactory, { ECPairInterface } from '@scrypt-inc/ecpair';
import * as tools from 'uint8array-tools';
import { toXOnly, toBitcoinNetwork } from '../utils/common.js';
import { SignOptions, Signer } from '../signer.js';
import * as bitcoinjs from '@scrypt-inc/bitcoinjs-lib';
import { SupportedNetwork } from '../globalTypes.js';
import { DEFAULT_NETWORK } from '../utils/constants.js';
const ECPair = ECPairFactory(ecc);
bitcoinjs.initEccLib(ecc);

export enum AddressType {
  P2WPKH = 'p2wpkh',
  P2TR = 'p2tr',
}

/**
 * An implemention of a simple signer which should just be used in nodejs environments.
 * @category Signer
 */
export class DefaultSigner implements Signer {
  constructor(
    private readonly keyPair: ECPairInterface = ECPair.makeRandom(),
    public readonly network: SupportedNetwork = DEFAULT_NETWORK,
    public readonly addressType: AddressType = AddressType.P2TR,
  ) {}

  async getAddress(): Promise<string> {
    if (this.addressType === AddressType.P2TR) {
      return this.getP2TRAddress();
    } else if (this.addressType === AddressType.P2WPKH) {
      return this.getP2WPKHAddress();
    } else {
      throw new Error('Invalid addressType');
    }
  }

  async getPublicKey(): Promise<string> {
    return Promise.resolve(tools.toHex(this.keyPair.publicKey));
  }

  async signPsbt(psbtHex: string, options?: SignOptions): Promise<string> {
    const psbt = bitcoinjs.Psbt.fromHex(psbtHex);
    const { output } = bitcoinjs.payments.p2tr({
      address: this.getP2TRAddress(),
      network: toBitcoinNetwork(this.network),
    });
    const taprootHex = tools.toHex(output!);
    const xpubkey = await this.getXOnlyPublicKey();
    const address = await this.getAddress();
    if (options) {
      options.toSignInputs.forEach((inputOpt) => {
        if (inputOpt.address && inputOpt.address !== address) {
          return;
        }
        if (bitcoinjs.bip371.isTaprootInput(psbt.data.inputs[inputOpt.index])) {
          const witnessUtxoScript = tools.toHex(
            psbt.data.inputs[inputOpt.index].witnessUtxo?.script,
          );

          if (witnessUtxoScript === taprootHex) {
            // fee utxos
            psbt.updateInput(inputOpt.index, {
              tapInternalKey: tools.fromHex(xpubkey),
            });

            const sighashTypes = inputOpt.sighashTypes || [bitcoinjs.Transaction.SIGHASH_DEFAULT];
            psbt.signTaprootInput(
              inputOpt.index,
              this.getKeyPair(),
              inputOpt.tapLeafHashToSign ? tools.fromHex(inputOpt.tapLeafHashToSign!) : undefined,
              sighashTypes,
            );
          } else {
            // taproot Covenant
            const sighashTypes = inputOpt.sighashTypes || [bitcoinjs.Transaction.SIGHASH_DEFAULT];
            psbt.signTaprootInput(
              inputOpt.index,
              this.getKeyPair(),
              inputOpt.tapLeafHashToSign ? tools.fromHex(inputOpt.tapLeafHashToSign) : undefined,
              sighashTypes,
            );
          }
        } else {
          const sighashTypes = inputOpt.sighashTypes || [bitcoinjs.Transaction.SIGHASH_ALL];
          psbt.signInput(inputOpt.index, this.keyPair, sighashTypes);
        }
      });
    } else {
      psbt.data.inputs.forEach((input, inputIdx) => {
        if (bitcoinjs.bip371.isTaprootInput(input)) {
          const witnessUtxoScript = tools.toHex(psbt.data.inputs[inputIdx].witnessUtxo?.script);

          if (witnessUtxoScript === taprootHex) {
            psbt.updateInput(inputIdx, {
              tapInternalKey: tools.fromHex(xpubkey),
            });

            const sighashTypes = [bitcoinjs.Transaction.SIGHASH_DEFAULT];
            psbt.signTaprootInput(inputIdx, this.getKeyPair(), undefined, sighashTypes);
          }
        } else {
          psbt.signInput(inputIdx, this.keyPair, [bitcoinjs.Transaction.SIGHASH_ALL]);
        }
      });
    }
    return Promise.resolve(psbt.toHex());
  }
  signPsbts(reqs: { psbtHex: string; options?: SignOptions }[]): Promise<string[]> {
    return Promise.all(reqs.map((req) => this.signPsbt(req.psbtHex, req.options)));
  }

  private getKeyPair() {
    if (this.addressType === AddressType.P2TR) {
      return ECPair.fromPrivateKey(this.getTweakedPrivateKey());
    } else if (this.addressType === AddressType.P2WPKH) {
      return this.keyPair;
    } else {
      throw new Error('Invalid addressType');
    }
  }

  private getP2TRAddress(): string {
    const ketPair = ECPair.fromPrivateKey(this.getPrivateKey());
    const internalPubkey = ketPair.publicKey.subarray(1, 33);
    const { address } = bitcoinjs.payments.p2tr({
      internalPubkey: internalPubkey,
      network: toBitcoinNetwork(this.network),
    });
    return address!;
  }

  private getP2WPKHAddress(): string {
    const pubkey = this.keyPair.publicKey;
    const { address } = bitcoinjs.payments.p2wpkh({
      pubkey: pubkey,
      network: toBitcoinNetwork(this.network),
    });
    return address!;
  }

  private async getXOnlyPublicKey(): Promise<string> {
    const pubkey = await this.getPublicKey();
    return toXOnly(pubkey, this.addressType === AddressType.P2WPKH);
  }

  private getPrivateKey(): Uint8Array {
    return this.keyPair.privateKey;
  }

  private getTweakedPrivateKey(): Uint8Array {
    // Order of the curve (N) - 1
    const N_LESS_1 = tools.fromHex(
      'fffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364140',
    );
    // 1 represented as 32 bytes BE
    const ONE = tools.fromHex('0000000000000000000000000000000000000000000000000000000000000001');

    const privateKey =
      this.keyPair.publicKey[0] === 2
        ? this.keyPair.privateKey
        : ecc.privateAdd(ecc.privateSub(N_LESS_1, this.keyPair.privateKey), ONE);
    const tweakHash = bitcoinjs.crypto.taggedHash(
      'TapTweak',
      this.keyPair.publicKey.subarray(1, 33),
    );
    return ecc.privateAdd(privateKey, tweakHash);
  }
}
