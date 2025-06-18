import { assert, method, SmartContract } from '@opcat-labs/scrypt-ts-opcat';

export class ForLoop extends SmartContract {
  @method()
  public unlock(a: bigint) {
    // invalid
    for (let i = 1; i < 10; i++) {
      assert(true);
    }
    // invalid
    for (let i = 0n; i < a; i++) {
      assert(true);
    }
    // invalid
    for (let i = 0n; i < 10n; ++i) {
      assert(true);
    }
    // valid
    for (let i = 0; i < 10; i++) {
      assert(true);
    }
  }
}
