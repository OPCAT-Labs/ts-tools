import { BaseCounter2 } from './baseCounter2';

import { method, prop, assert, hash256, TxUtils, Int32 } from '@scrypt-inc/scrypt-ts-btc';

export type HeritageCounter2State = {
  counter: Int32;
};

export class HeritageCounter2 extends BaseCounter2<HeritageCounter2State> {
  constructor(x: bigint, y: bigint) {
    super(x + y);
  }

  @method()
  public unlockWhenStateEquals5() {
    this.checkDummyProp();
    assert(this.state.counter == 5n, 'counter should be 5');
  }
}
