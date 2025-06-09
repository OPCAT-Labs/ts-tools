import { hexToUint8Array, uint8ArrayToHex } from '../../utils/common.js';
import { ByteString, Int32 } from '../types/primitives.js';
import { bn } from '@scrypt-inc/bitcoinjs-lib';
import { getValidatedHexString } from '../types/utils.js';

/**
 * Converts a literal to ByteString.
 * If not passing `isUtf8` or `isUtf8` is false, then `literal` should be in the format of hex literal, i.e. `/^([0-9a-fA-F]{2})*$/`
 * Otherwise, `literal` should be in the format of utf8 literal, i.e. `hello world`
 * @category Global Function
 * @onchain
 * @param {string} literal literal string, can be hex literal or utf8 literal, depends on the `isUtf8` marker
 * @param {boolean} isUtf8 marker indicating whether `literal` is utf8 or hex
 * @returns {ByteString} returns a ByteString
 */
export function toByteString(literal: string, isUtf8: boolean = false): ByteString {
  if (isUtf8 === true) {
    const encoder = new TextEncoder();
    const uint8array = encoder.encode(literal);
    return getValidatedHexString(uint8ArrayToHex(uint8array));
  }
  if (literal.length % 2 !== 0) {
    throw new Error('hex literal length must be even');
  }
  return literal;
}

/**
 * Int32 can be converted to a byte string with int2ByteString.
 * @param n - a number being converts
 * @category Global Function
 * @onchain
 * @returns {ByteString} returns a ByteString
 * @throws {Error} throws an error if the number is out of range
 */
export function int32ToByteString(n: Int32): ByteString {
  if (n > 2 ** 31 || n < -(2 ** 31)) {
    throw new Error('int32 out of range');
  }
  return toByteString(uint8ArrayToHex(bn.bn2Buf(n)));
}

/**
 * ByteString can be converted to bigint with byteString2Int.
 * @param a - a ByteString being converts
 * @category Global Function
 * @onchain
 * @returns {Int32} returns a number
 * @throws {Error} throws an error if the number is out of range or
 */
export function byteStringToInt32(a: ByteString): Int32 {
  const n = bn.buf2BN(hexToUint8Array(a), true);
  if (n > 2 ** 31 || n < -(2 ** 31)) {
    throw new Error('int32 out of range');
  }
  return n;
}

/**
 * Returns the length of the ByteString. Not the length of the string.
 * @category Global Function
 * @onchain
 * @param a - a ByteString
 * @returns {bigint} The length of the ByteString.
 */
export function len(a: ByteString): Int32 {
  return BigInt(a.length / 2);
}
