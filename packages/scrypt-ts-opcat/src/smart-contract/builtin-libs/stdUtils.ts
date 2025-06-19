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
  index: bigint;
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


  /**
     * encode data in 'buf' to a [VarInt (variable integer)]{@link https://learnmeabitcoin.com/technical/general/compact-size/} format; opposite of readVarint
     * @param {ByteString} buf a buffer `ByteString` containing the data
     * @returns return format: [prefix FD/FE/FF +] length + data
  */
  @method()
  static writeVarint(buf: ByteString): ByteString {
    let n = len(buf);

    let header: ByteString = toByteString('');

    if (n < 0xfdn) {
      header = StdUtils.toLEUnsigned(n, 1n);
    }
    else if (n < 0x10000n) {
      header = toByteString('fd') + StdUtils.toLEUnsigned(n, 2n);
    }
    else if (n < 0x100000000n) {
      header = toByteString('fe') + StdUtils.toLEUnsigned(n, 4n);
    }
    else if (n < 0x10000000000000000n) {
      header = toByteString('ff') + StdUtils.toLEUnsigned(n, 8n);
    }

    return header + buf;
  }

  /**
     * read [VarInt (variable integer)]{@link https://learnmeabitcoin.com/technical/general/compact-size/}-encoded data from the beginning of 'buf'
     * @param {ByteString} buf a buffer `ByteString` of format: [prefix FD/FE/FF +] length + data
     * @returns return data
     */
  static readVarint(buf: ByteString, index: bigint): ReadVarintResult {
    let l: bigint = 0n;
    let ret: ByteString = toByteString('');
    let nextIndex: bigint = index;
    const header: ByteString = slice(buf, index, index + 1n);

    if (header == toByteString('fd')) {
      l = StdUtils.fromLEUnsigned(slice(buf, index + 1n, index + 3n));
      ret = slice(buf, 3n, 3n + l);
      nextIndex = index + 3n + l;
    }
    else if (header == toByteString('fe')) {
      l = StdUtils.fromLEUnsigned(slice(buf, index + 1n, index + 5n));
      ret = slice(buf, index + 5n, index + 5n + l);
      nextIndex = index + 5n + l;
    }
    else if (header == toByteString('ff')) {
      l = StdUtils.fromLEUnsigned(slice(buf, index + 1n, index + 9n));
      ret = slice(buf, index + 9n, index + 9n + l);
      nextIndex = index + 9n + l;
    } else {
      l = StdUtils.fromLEUnsigned(slice(buf, index, index + 1n));
      ret = slice(buf, index + 1n, index + 1n + l);
      nextIndex = index + 1n + l;
    }

    return { data: ret, index: nextIndex };
  }
}