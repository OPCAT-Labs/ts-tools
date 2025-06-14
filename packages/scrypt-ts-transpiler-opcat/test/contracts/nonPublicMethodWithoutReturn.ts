import { assert, method, SmartContract } from '@scrypt-inc/scrypt-ts-btc';

export class NonPublicMethodWithoutReturn extends SmartContract {
  @method()
  hello(condition: boolean): void {
    assert(condition, 'throw in `hello`');
  }

  @method()
  world(): bigint {
    return 1n;
  }

  @method()
  public good() {
    assert(this.world() == 1n, 'should pass');
  }

  @method()
  public bad() {
    this.hello(false);
    assert(true);
  }
}
