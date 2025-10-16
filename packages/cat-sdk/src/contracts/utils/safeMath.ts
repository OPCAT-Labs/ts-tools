import { SmartContractLib, assert, method } from '@opcat-labs/scrypt-ts-opcat'

/**
 * The safe math utilities for the CAT contracts
 * @category Utils
 * @category Contract
 * @onchain
 */
export class SafeMath extends SmartContractLib {
  @method()
  static add(a: bigint, b: bigint): bigint {
    const c = a + b
    assert(c >= a && c >= b)
    return c
  }
}
