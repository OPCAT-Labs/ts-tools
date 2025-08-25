import { SmartContract, assert, method } from '@opcat-labs/scrypt-ts';

export class AbsTimeLock extends SmartContract {
  @method()
  public unlock() {
    assert(this.timeLock(400000n));
  }
}
