import { crypto, PublicKey, Interpreter } from '@opcat-labs/opcat';
import { Sig, PubKey, ByteString } from '../types/index.js';
import { sha256, toByteString } from '../fns/index.js';
import { AbstractContract } from '../abstractContract.js';

/**
 * Validates pure DER signature encoding (without sighash type).
 * This is similar to isTxDER but expects the signature without the trailing sighash byte.
 *
 * @param buf - The buffer containing the signature to verify
 * @returns true if the signature is valid DER-encoded, false otherwise
 */
function isDER(buf: Buffer): boolean {
  if (buf.length < 8) {
    // Non-canonical signature: too short (min DER sig is 8 bytes)
    return false;
  }
  if (buf.length > 72) {
    // Non-canonical signature: too long (max DER sig is 72 bytes without sighash)
    return false;
  }
  if (buf[0] !== 0x30) {
    // Non-canonical signature: wrong type
    return false;
  }
  if (buf[1] !== buf.length - 2) {
    // Non-canonical signature: wrong length marker (for pure DER, length = buf.length - 2)
    return false;
  }
  const nLenR = buf[3];
  if (5 + nLenR >= buf.length) {
    // Non-canonical signature: S length misplaced
    return false;
  }
  const nLenS = buf[5 + nLenR];
  if (nLenR + nLenS + 6 !== buf.length) {
    // Non-canonical signature: R+S length mismatch (for pure DER, total = R + S + 6)
    return false;
  }

  const R = buf.slice(4);
  if (buf[4 - 2] !== 0x02) {
    // Non-canonical signature: R value type mismatch
    return false;
  }
  if (nLenR === 0) {
    // Non-canonical signature: R length is zero
    return false;
  }
  if (R[0] & 0x80) {
    // Non-canonical signature: R value negative
    return false;
  }
  if (nLenR > 1 && R[0] === 0x00 && !(R[1] & 0x80)) {
    // Non-canonical signature: R value excessively padded
    return false;
  }

  const S = buf.slice(6 + nLenR);
  if (buf[6 + nLenR - 2] !== 0x02) {
    // Non-canonical signature: S value type mismatch
    return false;
  }
  if (nLenS === 0) {
    // Non-canonical signature: S length is zero
    return false;
  }
  if (S[0] & 0x80) {
    // Non-canonical signature: S value negative
    return false;
  }
  if (nLenS > 1 && S[0] === 0x00 && !(S[1] & 0x80)) {
    // Non-canonical signature: S value excessively padded
    return false;
  }
  return true;
}

/**
 * Checks if a signature has valid DER encoding and meets additional verification flags.
 * For OP_CHECKSIGFROMSTACK, signatures are pure DER without sighash type.
 *
 * @param signature - The signature to validate (pure DER, no sighash type)
 * @returns true if signature is empty or passes all required checks (DER encoding, low-S)
 * @remarks
 * - Empty signatures are allowed for compact invalid signatures in CHECK(MULTI)SIG
 * - Checks DER encoding by default
 * - Additional checks for low-S depend on Interpreter flags
 */
function checkSignatureEncoding(signature: Sig): boolean {
  const buf = Buffer.from(toByteString(signature), 'hex');
  let sig: crypto.Signature;

  // Empty signature. Not strictly DER encoded, but allowed to provide a
  // compact way to provide an invalid signature for use with CHECK(MULTI)SIG
  if (buf.length === 0) {
    return true;
  }

  // For OP_CHECKSIGFROMSTACK, use pure DER validation (no sighash type)
  if (!isDER(buf)) {
    return false;
  } else if ((Interpreter.DEFAULT_FLAGS & Interpreter.SCRIPT_VERIFY_LOW_S) !== 0) {
    sig = crypto.Signature.fromDER(buf);
    if (!sig.hasLowS()) {
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
 * @param signature - The signature to verify in hex format (pure DER encoded, NO sighash type)
 * @param message - The message that was signed (will be SHA256 hashed once)
 * @param publickey - The public key in hex format to verify the signature against
 * @returns true if the signature is valid for the given message and public key,
 *          false if invalid or if encoding checks fail
 *
 * @remarks
 * - Uses SHA256 single hash on the message (not hash256 double hash)
 * - Stack order for OP_CHECKSIGFROMSTACK: <sig> <msg> <pubKey> (bottom to top)
 * - Unlike OP_CHECKSIG, OP_CHECKSIGFROMSTACK does NOT require sighash type appended to signature
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
    // For OP_CHECKSIGFROMSTACK, signature is pure DER (no sighash type)
    const sig = crypto.Signature.fromDER(bufSig);
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
