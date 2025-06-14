import { assert, method, SmartContract } from '@scrypt-inc/scrypt-ts-btc';

export class CallMethod extends SmartContract {
  @method()
  foo(): void {}

  bar(): void {}

  @method()
  hello(): void {
    this.foo(); // valid
  }

  @method()
  world(): void {
    this.bar(); // invalid
  }

  helloWorld(): void {
    this.foo(); // vaild
    this.bar(); // valid
  }

  @method()
  public unlock() {
    assert(true);
  }
}
