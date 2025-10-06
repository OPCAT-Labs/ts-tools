import * as bip66 from './bip66.js';
import * as v from 'valibot';
import * as tools from 'uint8array-tools';

/**
 * A schema for validating a UInt8 value.
 * It ensures the value is an integer between 0 and 255 (inclusive).
 */
const UInt8Schema = v.pipe(
  v.number(),
  v.integer(),
  v.minValue(0),
  v.maxValue(0xff),
);




/**
 * Creates a validation schema for a fixed-size Uint8Array buffer.
 * @param size - The exact length required for the Uint8Array
 * @returns A validation schema that ensures the input is a Uint8Array of the specified size
 */
const SignatureSchema = v.pipe(v.instance(Uint8Array), v.maxLength(72), v.minLength(68));

const ZERO = new Uint8Array(1);


/**
 * Checks if the given hash type is a defined Bitcoin signature hash type.
 * @param hashType - The hash type to check (e.g. SIGHASH_ALL, SIGHASH_NONE)
 * @returns True if the hash type is valid (between 0x01 and 0x03, ignoring SIGHASH_ANYONECANPAY flag)
 */
export function isDefinedHashType(hashType: number): boolean {
  const hashTypeMod = hashType & ~0x80;

  return hashTypeMod > 0x00 && hashTypeMod < 0x04;
}

/**
 * Converts a buffer to a DER-encoded buffer.
 * @param x - The buffer to be converted.
 * @returns The DER-encoded buffer.
 */
export function toDER(x: Uint8Array): Uint8Array {
  let i = 0;
  while (x[i] === 0) ++i;
  if (i === x.length) return ZERO;
  x = x.slice(i);
  if (x[0] & 0x80) return tools.concat([ZERO, x]);
  return x;
}

/**
 * Converts a DER-encoded signature to a buffer.
 * If the first byte of the input buffer is 0x00, it is skipped.
 * The resulting buffer is 32 bytes long, filled with zeros if necessary.
 * @param x - The DER-encoded signature.
 * @returns The converted buffer.
 */
export function fromDER(x: Uint8Array): Uint8Array {
  if (x[0] === 0x00) x = x.slice(1);
  const buffer = new Uint8Array(32);
  const bstart = Math.max(0, 32 - x.length);
  buffer.set(x, bstart);
  return buffer;
}

/**
 * Represents a script signature consisting of a signature and hash type.
 * @property signature - The signature bytes
 * @property hashType - The hash type used for signing
 */
export interface ScriptSignature {
  signature: Uint8Array;
  hashType: number;
}


// BIP62: 1 byte hashType flag (only 0x01, 0x02, 0x03, 0x81, 0x82 and 0x83 are allowed)
/**
 * Decodes a buffer into a ScriptSignature object.
 * @param buffer - The buffer to decode.
 * @returns The decoded ScriptSignature object.
 * @throws Error if the hashType is invalid.
 */
export function decode(
  buffer: Uint8Array,
  strict: boolean = true,
): ScriptSignature {
  const hashType = tools.readUInt8(buffer, buffer.length - 1);
  if (strict && !isDefinedHashType(hashType)) {
    throw new Error('Invalid hashType ' + hashType);
  }
  let decoded: { r: Uint8Array; s: Uint8Array };
  try {
    decoded = bip66.decode(buffer.subarray(0, -1));
  } catch (error) {
    if (strict) {
      throw error;
    } else {
      decoded = bip66.parseDER(buffer.subarray(0, -1));
    }
  }

  const r = fromDER(decoded.r);
  const s = fromDER(decoded.s);
  const signature = tools.concat([r, s]);
  return { signature, hashType };
}

/**
 * Encodes a signature and hash type into a buffer.
 * @param signature - The signature to encode.
 * @param hashType - The hash type to encode.
 * @returns The encoded buffer.
 * @throws Error if the hashType is invalid.
 */
export function encode(signature: Uint8Array, hashType: number): Uint8Array {
  v.parse(
    v.object({
      signature: SignatureSchema,
      hashType: UInt8Schema,
    }),
    { signature, hashType },
  );

  if (!isDefinedHashType(hashType)) {
    throw new Error('Invalid hashType ' + hashType);
  }

  const hashTypeBuffer = new Uint8Array(1);
  tools.writeUInt8(hashTypeBuffer, 0, hashType);

  return tools.concat([signature, hashTypeBuffer]);
}

/**
 * This function is translated from bitcoind's IsDERSignature and is used in
 * the script interpreter.  This "DER" format actually includes an extra byte,
 * the nhashtype, at the end. It is really the tx format, not DER format.
 *
 * A canonical signature exists of: [30] [total len] [02] [len R] [R] [02] [len S] [S] [hashtype]
 * Where R and S are not negative (their first byte has its highest bit not set), and not
 * excessively padded (do not start with a 0 byte, unless an otherwise negative number follows,
 * in which case a single 0 byte is necessary and even required).
 *
 * See https://bitcointalk.org/index.php?topic=8392.msg127623#msg127623
 */
export function isTxDER(buf: Uint8Array) {
  if (buf.length < 9) {
    //  Non-canonical signature: too short
    return false;
  }
  if (buf.length > 73) {
    // Non-canonical signature: too long
    return false;
  }
  if (buf[0] !== 0x30) {
    //  Non-canonical signature: wrong type
    return false;
  }
  if (buf[1] !== buf.length - 3) {
    //  Non-canonical signature: wrong length marker
    return false;
  }
  const nLenR = buf[3];
  if (5 + nLenR >= buf.length) {
    //  Non-canonical signature: S length misplaced
    return false;
  }
  const nLenS = buf[5 + nLenR];
  if (nLenR + nLenS + 7 !== buf.length) {
    //  Non-canonical signature: R+S length mismatch
    return false;
  }

  const R = buf.slice(4);
  if (buf[4 - 2] !== 0x02) {
    //  Non-canonical signature: R value type mismatch
    return false;
  }
  if (nLenR === 0) {
    //  Non-canonical signature: R length is zero
    return false;
  }
  if (R[0] & 0x80) {
    //  Non-canonical signature: R value negative
    return false;
  }
  if (nLenR > 1 && R[0] === 0x00 && !(R[1] & 0x80)) {
    //  Non-canonical signature: R value excessively padded
    return false;
  }

  const S = buf.slice(6 + nLenR);
  if (buf[6 + nLenR - 2] !== 0x02) {
    //  Non-canonical signature: S value type mismatch
    return false;
  }
  if (nLenS === 0) {
    //  Non-canonical signature: S length is zero
    return false;
  }
  if (S[0] & 0x80) {
    //  Non-canonical signature: S value negative
    return false;
  }
  if (nLenS > 1 && S[0] === 0x00 && !(S[1] & 0x80)) {
    //  Non-canonical signature: S value excessively padded
    return false;
  }
  return true;
}



/**
 * Checks if a script signature is in canonical format.
 * 
 * @param buffer - The signature to check as a Uint8Array
 * @returns true if the signature is canonical (valid DER encoding with defined hash type), false otherwise
 */
export function isCanonicalScriptSignature(buffer: Uint8Array): boolean {
  if (!(buffer instanceof Uint8Array)) return false;
  if (!isDefinedHashType(buffer[buffer.length - 1])) return false;

  return bip66.check(buffer.slice(0, -1));
}