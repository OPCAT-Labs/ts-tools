import { SmartContract, assert, method, prop } from '@opcat-labs/scrypt-ts';

export class TimeLock extends SmartContract {
  @prop()
  matureTime: bigint;

  constructor(matureTime: bigint) {
    super(...arguments);
    this.matureTime = matureTime;
  }

  @method()
  public unlock() {
    assert(this.timeLock(this.matureTime));
    assert(!this.timeLock(this.matureTime + 10000n));
    assert(!this.timeLock(this.matureTime + 10000n) && true, 'invalid time lock');
  }
}
