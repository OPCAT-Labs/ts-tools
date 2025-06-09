import { SmartContract, assert, method } from '../../src/index.js';

export class CLTV extends SmartContract {
  @method()
  public unlock() {
    assert(this.absTimeLock(400000n));
  }
}
