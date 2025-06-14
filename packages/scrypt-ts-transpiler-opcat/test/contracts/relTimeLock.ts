import { SmartContract, assert, method } from '@scrypt-inc/scrypt-ts-btc';

export class RelTimeLock extends SmartContract {
  @method()
  public unlock() {
    assert(this.relTimeLock(20n));
  }
}
