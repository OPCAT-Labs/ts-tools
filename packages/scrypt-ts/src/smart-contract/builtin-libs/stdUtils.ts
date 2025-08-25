import { method } from "../decorators.js";
import { assert } from "../fns/assert.js";
import { byteStringToInt, intToByteString, len, slice, toByteString } from "../fns/byteString.js";
import { SmartContractLib } from "../smartContractLib.js";
import { ByteString, UInt32, UInt64 } from "../types/primitives.js";


export const UINT64_MAX = 0xffffffffffffffffn;
export const UINT64_MIN = 0n;
export const UINT32_MAX = 0xffffffffn;
export const UINT32_MIN = 0n;

type ReadVarintResult = {
  data: ByteString;
  nextPos: bigint;
}

/**
 * A utility class providing standard helper methods for working with ByteStrings and numeric conversions.
 * Includes methods for:
 * - Checking ByteString length divisibility
 * - Converting between numeric types (UInt32, UInt64) and ByteStrings
 * - Little-endian unsigned integer conversions
 * - Variable-length integer (VarInt) serialization/deserialization
 * - Push data serialization for Bitcoin script
 * All methods are static and annotated with @method() decorator.
 */
export class StdUtils extends SmartContractLib {
  /**
   * Checks if the length of a ByteString is divisible by a given number and returns the quotient.
   * @param b The ByteString to check
   * @param n The divisor to check against
   * @returns The quotient of the division (length / n)
   * @throws If the length is not divisible by n
   */
  @method()
  static checkLenDivisibleBy(b: ByteString, n: bigint): bigint {
    const l = len(b);
    assert(l % n == 0n, 'length of b is not divisible by n');
    return l / n;
  }


  /**
   * Converts a UInt64 value to a little-endian ByteString.
   * @param n The UInt64 value to convert
   * @returns The little-endian ByteString representation
   * @throws If the input value is outside UInt64 range (0 to 2^64-1)
   */
  @method()
  static uint64ToByteString(n: UInt64): ByteString {
    assert(n >= UINT64_MIN && n <= UINT64_MAX, 'uint64 out of range');
    return StdUtils.toLEUnsigned(n, 8n);
  }

  /**
   * Converts a UInt32 number to a 4-byte little-endian ByteString.
   * @param n The UInt32 number to convert
   * @returns The resulting 4-byte little-endian ByteString
   * @throws If the input number is outside the UInt32 range (0 to 4294967295)
   */
  @method()
  static uint32ToByteString(n: UInt32): ByteString {
    assert(n >= UINT32_MIN && n <= UINT32_MAX, 'uint32 out of range');
    return StdUtils.toLEUnsigned(n, 4n)
  }

  /**
   * Converts a 4-byte ByteString to an unsigned 32-bit integer in little-endian format.
   * @param b - The ByteString to convert (must be exactly 4 bytes long)
   * @returns The converted UInt32 value
   * @throws Will throw an error if the input ByteString length is not 4 bytes
   */
  @method()
  static byteStringToUInt32(b: ByteString): UInt32 {
    assert(len(b) == 4n, 'byteStringToUInt32: byteString length is not 4');
    return StdUtils.fromLEUnsigned(b);
  }

  /**
   * convert signed integer `n` to unsigned integer of `l` string, in little endian
   * @param {bigint} n the number to be converted
   * @param {bigint} l expected length
   * @returns {ByteString} returns a `ByteString`
   */
  @method()
  static toLEUnsigned(n: bigint, l: bigint): ByteString {
    const m = intToByteString(n, l + 1n);
    // remove sign byte
    return slice(m, 0n, l);
  }

  /**
   * convert `ByteString` to unsigned integer, in sign-magnitude little endian
   * @param {ByteString} bytes the `ByteString` to be converted
   * @returns {bigint} returns a number
   */
  @method()
  static fromLEUnsigned(b: ByteString): bigint {
    return byteStringToInt(b + toByteString('00'));
  }

  /**
   * Encodes a bigint into a variable-length integer (VarInt) format as ByteString.
   * The encoding follows the standard VarInt scheme:
   * - Values < 0xfd: encoded as 1 byte
   * - Values < 0x10000: prefixed with 0xfd and encoded as 2 bytes (little-endian)
   * - Values < 0x100000000: prefixed with 0xfe and encoded as 4 bytes (little-endian)
   * - Larger values: prefixed with 0xff and encoded as 8 bytes (little-endian)
   * @param n - The bigint value to encode
   * @returns ByteString containing the VarInt encoded value
   */
  @method()
  static writeVarInt(n: bigint): ByteString {
    let b: ByteString = toByteString('');
    let size = 0n;
    if (n < 0xfdn) {
      size = 1n;
    }
    else if (n < 0x10000n) {
      b = toByteString('fd')
      size = 2n;
    }
    else if (n < 0x100000000n) {
      b = toByteString('fe')
      size = 4n;
    }
    else {
      b = toByteString('ff')
      size = 8n;
    }
    return b + StdUtils.toLEUnsigned(n, size);
  }



  /**
   * Pushes data to a buffer with appropriate size header.
   * 
   * @param buf - The input data as a ByteString
   * @returns The input data prefixed with appropriate size header in little-endian format
   * @remarks The header format follows standard Bitcoin script pushdata rules:
   *          - 0x4c for 1-byte length (0-255 bytes)
   *          - 0x4d for 2-byte length (256-65535 bytes)
   *          - 0x4e for 4-byte length (65536-4294967295 bytes)
   * @throws Will assert if input size exceeds 32-bit limit (4294967295 bytes)
   */
  @method()
  static pushData(buf: ByteString): ByteString {
    const n = len(buf);
    let size = 0n;
    let header: ByteString = toByteString('');

    if (n < 0x4c) {
      size = 1n;
      header = toByteString('');
    }
    else if (n < 0x100) {
      size = 1n;
      header = toByteString('4c')
    }
    else if (n < 0x10000) {
      size = 2n;
      header = toByteString('4d');
    }
    else if (n < 0x100000000) {
      size = 4n;
      header = toByteString('4e');
    }
    else {
      // shall not reach here
      assert(false);
    }

    return header + StdUtils.toLEUnsigned(n, size);
  }

  /**
     * read [VarInt (variable integer)]{@link https://learnmeabitcoin.com/technical/general/compact-size/}-encoded data from the beginning of 'buf'
     * @param {ByteString} buf a buffer `ByteString` of format: [prefix FD/FE/FF +] length + data
     * @returns return data
     */
  @method()
  static readVarint(buf: ByteString, pos: bigint): ReadVarintResult {
    let l: bigint = 0n;
    let ret: ByteString = toByteString('');
    let nextPos: bigint = pos;
    const header: ByteString = slice(buf, pos, pos + 1n);

    if (header == toByteString('fd')) {
      l = StdUtils.fromLEUnsigned(slice(buf, pos + 1n, pos + 3n));
      ret = slice(buf, 3n, 3n + l);
      nextPos = pos + 3n + l;
    }
    else if (header == toByteString('fe')) {
      l = StdUtils.fromLEUnsigned(slice(buf, pos + 1n, pos + 5n));
      ret = slice(buf, pos + 5n, pos + 5n + l);
      nextPos = pos + 5n + l;
    }
    else if (header == toByteString('ff')) {
      l = StdUtils.fromLEUnsigned(slice(buf, pos + 1n, pos + 9n));
      ret = slice(buf, pos + 9n, pos + 9n + l);
      nextPos = pos + 9n + l;
    } else {
      l = StdUtils.fromLEUnsigned(slice(buf, pos, pos + 1n));
      ret = slice(buf, pos + 1n, pos + 1n + l);
      nextPos = pos + 1n + l;
    }

    return { data: ret, nextPos: nextPos };
  }
}