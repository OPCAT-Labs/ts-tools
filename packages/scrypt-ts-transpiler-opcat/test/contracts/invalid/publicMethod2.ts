import { assert, method, SmartContract } from '@scrypt-inc/scrypt-ts-btc';

export class PublicMethod2 extends SmartContract {
  @method()
  public foo() {
    // invalid, the last statement of public method should be an `assert`
  }

  @method()
  public bar() {
    assert(true);
    return 1n; // invalid either, that is to say, public method cannot return any value
  }

  @method()
  public foobar() {
    console.log();
    // valid, `console.log` calling will be ignored when verifying the last `assert` statement
    assert(true);
    console.log();
    console.log();
  }
}
