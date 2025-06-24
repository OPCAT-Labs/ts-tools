import { method } from "../decorators.js";
import { assert } from "../fns/assert.js";
import { byteStringToInt, intToByteString, len, slice, toByteString } from "../fns/byteString.js";
import { SmartContractLib } from "../smartContractLib.js";
import { ByteString, PrivKey, UInt32, UInt64 } from "../types/primitives.js";


export const UINT64_MAX = 0xffffffffffffffffn;
export const UINT64_MIN = 0n;
export const UINT32_MAX = 0xffffffffn;
export const UINT32_MIN = 0n;

type ReadVarintResult = {
  data: ByteString;
  nextPos: bigint;
}

export class StdUtils extends SmartContractLib {
  @method()
  static checkLenDivisibleBy(b: ByteString, n: bigint): bigint {
    const l = len(b);
    assert(l % n == 0n, 'length of b is not divisible by n');
    return l / n;
  }


  @method()
  static uint64ToByteString(n: UInt64): ByteString {
    assert(n >= UINT64_MIN && n <= UINT64_MAX, 'uint64 out of range');
    return StdUtils.toLEUnsigned(n, 8n);
  }

  @method()
  static uint32ToByteString(n: UInt32): ByteString {
    assert(n >= UINT32_MIN && n <= UINT32_MAX, 'uint32 out of range');
    return StdUtils.toLEUnsigned(n, 4n)
  }

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
     * serializes `ByteString` with `VarInt` encoding
     * @param buf a `ByteString`
     * @returns serialized `ByteString`
     */
  @method()
  static pushData(buf: ByteString): ByteString {
    let n = len(buf);

    let header: ByteString = toByteString('');

    if (n < 0x4c) {
      header = StdUtils.toLEUnsigned(n, 1n);
    }
    else if (n < 0x100) {
      header = toByteString('4c') + StdUtils.toLEUnsigned(n, 1n);
    }
    else if (n < 0x10000) {
      header = toByteString('4d') + StdUtils.toLEUnsigned(n, 2n);
    }
    else if (n < 0x100000000) {
      header = toByteString('4e') + StdUtils.toLEUnsigned(n, 4n);
    }
    else {
      // shall not reach here
      assert(false);
    }

    return header + buf;
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