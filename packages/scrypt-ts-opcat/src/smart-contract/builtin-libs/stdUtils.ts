import { assert } from '../fns/assert.js';
import { method } from '../decorators.js';
import { int32ToByteString, len, toByteString } from '../fns/index.js';
import { SmartContractLib } from '../smartContractLib.js';
import { Int32, ByteString } from '../types/index.js';

export class StdUtils extends SmartContractLib {
  /**
   * Checks if a ByteString is equivalent to a number
   * @category Library
   * @onchain
   * @param i a number
   * @param b a ByteString
   * @returns true if success
   */
  @method()
  static checkInt32(i: Int32, b: ByteString): boolean {
    const iByte = int32ToByteString(i);
    const l = len(iByte);
    let fullByte = toByteString('');
    if (l == 0n) {
      fullByte = toByteString('00000000');
    } else if (l == 1n) {
      fullByte = iByte + toByteString('000000');
    } else if (l == 2n) {
      fullByte = iByte + toByteString('0000');
    } else if (l == 3n) {
      fullByte = iByte + toByteString('00');
    } else if (l == 4n) {
      fullByte = iByte;
    } else {
      assert(false, 'num overflow!');
    }
    return fullByte == b;
  }
}
