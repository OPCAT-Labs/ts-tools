import { Int32, SmartContract, assert, method, prop } from '@opcat-labs/scrypt-ts-opcat';

export class CLTV extends SmartContract {

  @prop()
  readonly lockedBlock: Int32;

  constructor(lockedBlock: Int32) {
    super(...arguments);
    this.lockedBlock = lockedBlock;
  }
  @method()
  public unlock() {
    assert(this.timeLock(this.lockedBlock), "timelock check failed");
  }
}
