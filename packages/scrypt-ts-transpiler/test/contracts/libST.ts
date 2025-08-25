import { method, SmartContract, assert, equals } from '@opcat-labs/scrypt-ts';

import { SS } from './lib';

/**
 * test reference struct defined in library
 */
export class TestLibST extends SmartContract {
  @method()
  public unlock(ss: SS) {
    assert(
      equals(ss, {
        a: 1n,
      }),
      'ss value error',
    );
  }
}
