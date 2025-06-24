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
  
}