import { hexToUint8Array, uint8ArrayToHex } from '../../utils/common.js';
import { ByteString, Int32 } from '../types/primitives.js';
import { getValidatedHexString } from '../types/utils.js';
import { bn2Buf, buf2BN } from '../types/bn.js';

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
    return uint8ArrayToHex(uint8array);
  }
  if (literal.length % 2 !== 0) {
    throw new Error('hex literal length must be even');
  }
  return getValidatedHexString(literal);
}

/**
 * int can be converted to a byte string with int2ByteString.
 * @param n - a number being converts
 * @param size - the size of the result byte string, if not specified, the size will be determined by the number of bytes required to represent the number.
 * @category Global Function
 * @onchain
 * @returns {ByteString} returns a ByteString
 * @throws {Error} throws an error if the number is out of range `size` bytes
 */
export function intToByteString(n: bigint, size?: bigint): ByteString {
  return toByteString(uint8ArrayToHex(bn2Buf(n, Number(size))));
}


// export function num2bin(n: bigint, size: bigint): ByteString {
//   return toByteString(uint8ArrayToHex(bn2Buf(n, Number(size))));
// }

// export function unpack(b: ByteString): bigint {
//   const n = buf2BN(hexToUint8Array(b), false);
//   return n;
// }

/**
 * ByteString can be converted to bigint with byteString2Int.
 * @param a - a ByteString being converts
 * @category Global Function
 * @onchain
 * @returns {Int32} returns a number
 */
export function byteStringToInt(a: ByteString): bigint {
  const n = buf2BN(hexToUint8Array(a), false);
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


/**
 * Returns a section of a ByteString.
 * @param byteString The ByteString.
 * @param start The beginning byte index of the specified portion of ByteString, included.
 * @param end The end byte index of the specified portion of ByteString, excluded.
 *  If this value is not specified, the sub-section continues to the end of ByteString.
 */
export function slice(byteString: ByteString, start: Int32, end?: Int32): ByteString {
  const startIndex = Number(start) * 2
  const endIndex = typeof end === 'bigint' ? Number(end) * 2 : byteString.length;
  if (startIndex < 0 || endIndex < 0) {
      throw new Error('index should not be negative')
  }
  if (typeof end === 'bigint' && startIndex > endIndex) {
      throw new Error('start index should be less than or equal to end index')
  }

  if (startIndex > byteString.length) {
      throw new Error('start index should not be greater than the length')
  }

  if (endIndex > byteString.length) {
      throw new Error('end index should not be greater than the length')
  }

  return byteString.slice(startIndex, endIndex)
}


/**
 * Returns reversed bytes of b, which is of size bytes. Note size must be a compiled-time constant.
 * It is often useful when converting a number between little-endian and big-endian.
 * @category Bytes Operations
 * @param b - a ByteString to be reversed
 * @param size - the size of the ByteString.
 * @returns {ByteString} reversed ByteString.
 */
export function reverseByteString(b: ByteString, size: Int32): ByteString {
    const l = len(b);

    if (l != size) {
        throw new Error(`reverseByteString error, expected c = ${l}`)
    }

    return b.match(/[a-fA-F0-9]{2}/g).reverse().join('');
}
