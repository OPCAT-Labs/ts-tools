import { SmartContract, assert, method } from '@opcat-labs/scrypt-ts-opcat';

export class RelTimeLock extends SmartContract {
  @method()
  public unlock() {
    assert(this.timeLock(20n));
  }
}
