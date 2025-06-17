import { SmartContract, assert, method } from '@opcat-labs/scrypt-ts-opcat';

export class AbsTimeLock extends SmartContract {
  @method()
  public unlock() {
    assert(this.absTimeLock(400000n));
  }
}
