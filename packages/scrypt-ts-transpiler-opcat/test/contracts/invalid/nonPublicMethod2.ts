import { assert, method, SmartContract } from '@scrypt-inc/scrypt-ts-btc';

export class NonPublicMethod2 extends SmartContract {
  @method()
  foo() {
    // invalid, non-public methods must declare the return type explicitly
  }

  @method()
  bar() {
    // invalid, either
    return 2n;
  }

  @method()
  hello(): void {
    // valid
  }

  @method()
  world(): bigint {
    // valid
    return 1n;
  }

  @method()
  public unlock() {
    assert(true);
  }
}
