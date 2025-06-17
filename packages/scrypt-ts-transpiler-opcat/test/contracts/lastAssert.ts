import { assert, method, SmartContract } from '@opcat-labs/scrypt-ts-opcat';

export class LastAssert extends SmartContract {
  @method()
  public unlock() {
    console.log();
    assert(true);
    console.log();
    console.log();
  }
}
