import { SmartContract, assert, method } from '@scrypt-inc/scrypt-ts-btc';

export class AbsTimeLock extends SmartContract {
  @method()
  public unlock() {
    assert(this.absTimeLock(400000n));
  }
}
