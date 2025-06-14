import { method, prop, SmartContract, assert } from '@scrypt-inc/scrypt-ts-btc';

/**
 * a base contract without public method
 */
export abstract class DemoBase extends SmartContract {
  @prop()
  readonly x: bigint;

  @prop()
  readonly y: bigint;

  constructor(x: bigint, y: bigint) {
    super(...arguments);
    this.x = x;
    this.y = y;
  }

  @method()
  xyDiff(): bigint {
    return this.x - this.y;
  }
}
