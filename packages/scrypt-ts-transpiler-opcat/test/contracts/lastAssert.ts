import { assert, method, SmartContract } from '@scrypt-inc/scrypt-ts-btc';

export class LastAssert extends SmartContract {
  @method()
  public unlock() {
    console.log();
    assert(true);
    console.log();
    console.log();
  }
}
