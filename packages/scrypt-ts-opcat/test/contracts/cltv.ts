import { Int32, SmartContract, assert, method, prop } from '../../src/index.js';

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
