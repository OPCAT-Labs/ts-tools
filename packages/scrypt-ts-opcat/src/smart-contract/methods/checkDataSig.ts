import { crypto, PublicKey, Interpreter } from '@opcat-labs/opcat';
import { Sig, PubKey, ByteString } from '../types/index.js';
import { sha256, toByteString } from '../fns/index.js';
import { AbstractContract } from '../abstractContract.js';

/**
 * Checks if a signature has valid DER encoding and meets additional verification flags.
 *
 * @param signature - The signature to validate
 * @returns true if signature is empty or passes all required checks (DER encoding, low-S, strict encoding)
 * @remarks
 * - Empty signatures are allowed for compact invalid signatures in CHECK(MULTI)SIG
 * - Checks DER encoding by default
 * - Additional checks for low-S and strict encoding depend on Interpreter flags
 */
function checkSignatureEncoding(signature: Sig): boolean {
  const buf = Buffer.from(toByteString(signature), 'hex');
  let sig: crypto.Signature;

  // Empty signature. Not strictly DER encoded, but allowed to provide a
  // compact way to provide an invalid signature for use with CHECK(MULTI)SIG
  if (buf.length === 0) {
    return true;
  }

  if (!crypto.Signature.isTxDER(buf)) {
    return false;
  } else if ((Interpreter.DEFAULT_FLAGS & Interpreter.SCRIPT_VERIFY_LOW_S) !== 0) {
    sig = crypto.Signature.fromTxFormat(buf);
    if (!sig.hasLowS()) {
      return false;
    }
  } else if ((Interpreter.DEFAULT_FLAGS & Interpreter.SCRIPT_VERIFY_STRICTENC) !== 0) {
    sig = crypto.Signature.fromTxFormat(buf);
    if (!sig.hasDefinedHashtype()) {
      return false;
    }
  }

  return true;
}

/**
 * Checks if the provided public key has valid encoding.
 * @param publickey - The public key to validate
 * @returns true if the public key encoding is valid, false otherwise
 * @remarks Only performs strict validation when SCRIPT_VERIFY_STRICTENC flag is set
 */
function checkPubkeyEncoding(publickey: PubKey): boolean {
  if (
    (Interpreter.DEFAULT_FLAGS & Interpreter.SCRIPT_VERIFY_STRICTENC) !== 0 &&
    !PublicKey.isValid(toByteString(publickey))
  ) {
    return false;
  }
  return true;
}

/**
 * Verifies a signature against an explicit message and public key.
 * Unlike checkSig which uses the transaction preimage as the implicit message,
 * checkDataSig allows verifying signatures on arbitrary data.
 *
 * @ignore
 * @param self - The contract instance (unused, kept for consistency with other check methods)
 * @param signature - The signature to verify in hex format (DER encoded with sighash type)
 * @param message - The message that was signed (will be SHA256 hashed once)
 * @param publickey - The public key in hex format to verify the signature against
 * @returns true if the signature is valid for the given message and public key,
 *          false if invalid or if encoding checks fail
 *
 * @remarks
 * - Uses SHA256 single hash on the message (not hash256 double hash)
 * - Stack order for OP_CHECKSIGFROMSTACK: <sig> <msg> <pubKey> (bottom to top)
 */
export function checkDataSigImpl(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  self: AbstractContract,
  signature: Sig,
  message: ByteString,
  publickey: PubKey
): boolean {
  if (!checkSignatureEncoding(signature) || !checkPubkeyEncoding(publickey)) {
    return false;
  }

  let fSuccess = false;

  const bufSig = Buffer.from(signature, 'hex');
  const bufPubkey = Buffer.from(publickey, 'hex');
  const bufMsg = Buffer.from(message, 'hex');

  try {
    const sig = crypto.Signature.fromTxFormat(bufSig);
    const pubkey = PublicKey.fromBuffer(bufPubkey, false);

    // Compute SHA256 of message (single hash, not double hash)
    // This matches the OP_CHECKSIGFROMSTACK behavior
    // Reverse to little-endian format (same as checkSigImpl) for signature verification
    const hashbuf = Buffer.from(sha256(message), 'hex').reverse();

    // Verify using ECDSA with little endian (same as OP_CHECKSIGFROMSTACK)
    fSuccess = crypto.ECDSA.verify(hashbuf, sig, pubkey, 'little');
  } catch (_err) {
    // invalid sig or pubkey
    fSuccess = false;
  }

  return fSuccess;
}
