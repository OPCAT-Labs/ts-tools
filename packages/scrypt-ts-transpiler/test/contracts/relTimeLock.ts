import { SmartContract, assert, method } from '@opcat-labs/scrypt-ts';

export class RelTimeLock extends SmartContract {
  @method()
  public unlock() {
    assert(this.timeLock(20n));
  }
}
