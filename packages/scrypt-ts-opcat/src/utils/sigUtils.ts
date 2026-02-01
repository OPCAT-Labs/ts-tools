/**
 * Off-chain signing utilities for preimage verification.
 *
 * This module provides functions to generate signatures off-chain using a
 * hardcoded private key. The signatures can then be verified on-chain using
 * checkDataSig, avoiding the need for on-chain signature generation which
 * bloats script size.
 *
 * @module sigUtils
 */

import { crypto, PrivateKey, PublicKey, Networks } from '@opcat-labs/opcat';
import { hash256, sha256 } from '../smart-contract/fns/hashes.js';
import { ByteString, Sig, SigHashPreimage } from '../smart-contract/types/primitives.js';
import { SHPreimage } from '../smart-contract/types/structs.js';
import { ContextUtils } from '../smart-contract/builtin-libs/contextUtils.js';
import { encodeSHPreimage } from './preimage.js';

const { ECDSA, Signature } = crypto;

/**
 * The hardcoded private key used for preimage signing.
 * This must match the private key in ContextUtils.
 */
const PRIVATE_KEY_HEX = '26f00fe2340a84335ebdf30f57e9bb58487117b29355718f5e46bf5168d7df97';

/**
 * Signs a serialized preimage off-chain using the hardcoded private key.
 *
 * This function generates a DER-encoded ECDSA signature that can be verified
 * on-chain using checkSig. The message is hashed with hash256 (double SHA256)
 * to match the transaction interpreter's sighash calculation.
 *
 * Note: For checkDataSig (which uses single SHA256), a different signature
 * would be needed. The JavaScript runtime uses this hash256 version for
 * compatibility with checkSig verification.
 *
 * @param preimage - The serialized preimage bytes to sign
 * @param sigHashType - The signature hash type (default: 0x01 for SIGHASH_ALL)
 * @returns A DER-encoded signature with sigHashType appended
 */
export function signPreimage(preimage: SigHashPreimage | ByteString, sigHashType: number = 0x01): Sig {
  // Compute hash256 of the preimage (double SHA256 for checkSig compatibility)
  // Reverse the hash to match checkSigImpl's verification format
  const hash = Buffer.from(hash256(preimage as ByteString), 'hex').reverse();

  // Create private key from hex (using mainnet network)
  const privateKey = PrivateKey.fromHex(PRIVATE_KEY_HEX, Networks.defaultNetwork);

  // Sign the hash using ECDSA
  // Note: ECDSA.sign expects the hash and private key
  const signature = ECDSA.sign(hash, privateKey, 'little');

  // Get DER encoded signature
  const derSig = signature.toDER();

  // Append sigHashType byte
  const sigHashTypeByte = Buffer.from([sigHashType]);
  const fullSig = Buffer.concat([derSig, sigHashTypeByte]);

  return Sig(fullSig.toString('hex'));
}

/**
 * Signs a SHPreimage off-chain by first serializing it.
 *
 * This is a convenience wrapper around signPreimage that handles
 * the serialization of the SHPreimage struct.
 *
 * Note: Uses encodeSHPreimage (same as checkSigImpl) to ensure
 * the signature matches what checkSig expects.
 *
 * @param shPreimage - The SHPreimage struct to sign
 * @param sigHashType - The signature hash type (default: 0x01 for SIGHASH_ALL)
 * @returns A DER-encoded signature with sigHashType appended
 */
export function signSHPreimage(shPreimage: SHPreimage, sigHashType: number = 0x01): Sig {
  // Serialize the SHPreimage using encodeSHPreimage (same as checkSigImpl uses)
  const preimage = encodeSHPreimage(shPreimage);
  return signPreimage(preimage, sigHashType);
}

/**
 * Verifies a preimage signature off-chain.
 *
 * This function can be used to verify signatures before submitting
 * transactions, ensuring the signature is valid.
 *
 * @param sig - The signature to verify
 * @param preimage - The preimage that was signed
 * @returns true if the signature is valid, false otherwise
 */
export function verifyPreimageSig(sig: Sig, preimage: SigHashPreimage | ByteString): boolean {
  try {
    // Compute SHA256 hash of the preimage
    const hash = Buffer.from(sha256(preimage as ByteString), 'hex');

    // Get the signature bytes (without sigHashType)
    const sigBytes = Buffer.from(sig as string, 'hex');
    const derSig = sigBytes.slice(0, sigBytes.length - 1);

    // Parse the DER signature
    const signature = Signature.fromDER(derSig);

    // Get public key from ContextUtils
    const publicKey = PublicKey.fromHex(ContextUtils.pubKey as string);

    // Verify the signature
    return ECDSA.verify(hash, signature, publicKey, 'little');
  } catch (e) {
    return false;
  }
}
