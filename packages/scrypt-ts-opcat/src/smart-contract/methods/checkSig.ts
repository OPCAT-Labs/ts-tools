import { Transaction, bip371, getEccLib } from '@scrypt-inc/bitcoinjs-lib';
import { Sig, PubKey, SHPreimage } from '../types/index.js';
import { sha256 } from '../fns/index.js';
import * as tools from 'uint8array-tools';
import { PREIMAGE_PREFIX } from '../../utils/preimage.js';
import { AbstractContract } from '../abstractContract.js';
import { requireTrue } from '../../utils/common.js';

/**
 * @ignore
 */
export enum SignatureVersion {
  BASE = 0,
  WITNESS_V0 = 1,
  TAPROOT = 2,
  TAPSCRIPT = 3,
}

function sigHashV1(shPreimage: SHPreimage) {
  return sha256(
    PREIMAGE_PREFIX +
      shPreimage.nVersion +
      shPreimage.nLockTime +
      shPreimage.shaPrevouts +
      shPreimage.shaSpentAmounts +
      shPreimage.shaSpentScripts +
      shPreimage.shaSequences +
      shPreimage.shaOutputs +
      shPreimage.spendType +
      shPreimage.inputIndex +
      shPreimage.tapLeafHash +
      shPreimage.keyVersion +
      shPreimage.codeSepPos,
  );
}

/**
 * Verifies Schnorr signature
 * @param {Signature} sig
 * @param {PublicKey} pubkey
 * @param {Number} sigversion
 * @param {Object} execdata
 * @returns {Boolean}
 */
function checkSchnorrSignature(self: AbstractContract, sig: Uint8Array, pubkey: Uint8Array) {
  // this.ctx has all fields of shPreimage
  const shPreimage = self.ctx;

  requireTrue(sig && sig instanceof Uint8Array, 'Missing sig');
  requireTrue(pubkey && pubkey instanceof Uint8Array, 'Missing pubkey');
  requireTrue(
    pubkey.length === 32,
    'Schnorr signatures have 32-byte public keys. The caller is responsible for enforcing this.',
  );
  // Note that in Tapscript evaluation, empty signatures are treated specially (invalid signature that does not
  // abort script execution). This is implemented in EvalChecksigTapscript, which won't invoke
  // CheckSchnorrSignature in that case. In other contexts, they are invalid like every other signature with
  // size different from 64 or 65.
  if (!(sig.length === 64 || sig.length === 65)) {
    return false;
  }

  if (sig.length === 65 && sig[sig.length - 1] === Transaction.SIGHASH_DEFAULT) {
    return false;
  }

  const decodedSig = bip371.decodeSchnorrSignature(sig);

  const msghash = sigHashV1(shPreimage);

  const ecc = getEccLib();

  const verified = ecc.verifySchnorr!(tools.fromHex(msghash), pubkey, decodedSig.signature);
  return verified;
}

/**
 * @ignore
 * @param self
 * @param signature
 * @param publickey
 * @returns
 */
export function checkSigImpl(self: AbstractContract, signature: Sig, publickey: PubKey): boolean {
  return checkSchnorrSignature(self, tools.fromHex(signature), tools.fromHex(publickey));
}
