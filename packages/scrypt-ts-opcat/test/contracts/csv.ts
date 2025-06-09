import { SmartContract, assert, method } from '../../src/index.js';

export class CSV extends SmartContract {
  @method()
  public unlock() {
    assert(this.relTimeLock(20n));
  }
}
