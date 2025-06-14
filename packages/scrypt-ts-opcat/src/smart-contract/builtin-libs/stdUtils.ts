import { method } from "../decorators.js";
import { assert } from "../fns/assert.js";
import { len } from "../fns/byteString.js";
import { num2bin } from "../fns/byteString.js";
import { SmartContractLib } from "../smartContractLib.js";
import { ByteString, UInt32, UInt64 } from "../types/primitives.js";


export const UINT64_MAX = 0xffffffffffffffffn;
export const UINT64_MIN = 0n;
export const UINT32_MAX = 0xffffffffn;
export const UINT32_MIN = 0n;

export class StdUtils extends SmartContractLib {
  @method()
  static checkLenDivisibleBy(b: ByteString, n: bigint): bigint {
    assert(len(b) % n == 0n, 'length of b is not divisible by n');
    return len(b) / n;
  }


  @method()
  static uint64ToByteString(n: UInt64): ByteString {
    assert(n >= UINT64_MIN && n <= UINT64_MAX, 'uint64 out of range');
    return num2bin(n, 8n);
  }

  @method()
  static uint32ToByteString(n: UInt32): ByteString {
    assert(n >= UINT32_MIN && n <= UINT32_MAX, 'uint32 out of range');
    return num2bin(n, 4n);
  }
}