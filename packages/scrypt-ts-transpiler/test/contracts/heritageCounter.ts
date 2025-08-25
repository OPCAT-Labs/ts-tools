import { BaseCounter } from './basecounter';

import { method, prop, assert, hash256, TxUtils } from '@opcat-labs/scrypt-ts';

export class HeritageCounter extends BaseCounter {
  constructor(x: bigint, y: bigint) {
    super(x + y);
  }

  @method()
  public unlockWhenStateEquals5() {
    this.incCounter();
    assert(this.state.counter == 5n, 'counter should be 5');
  }
}
