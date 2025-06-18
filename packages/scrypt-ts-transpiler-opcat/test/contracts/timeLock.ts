import { SmartContract, assert, method, prop } from '@opcat-labs/scrypt-ts-opcat';

export class TimeLock extends SmartContract {
  @prop()
  matureTime: bigint;

  constructor(matureTime: bigint) {
    super(...arguments);
    this.matureTime = matureTime;
  }

  @method()
  public unlock() {
    assert(this.cltv(this.matureTime));
    assert(!this.cltv(this.matureTime + 10000n));
    assert(!this.cltv(this.matureTime + 10000n) && true, 'invalid time lock');
  }
}
