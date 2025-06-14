import { method, prop, SmartContract, assert } from '@scrypt-inc/scrypt-ts-btc';

export class DemoBigInt extends SmartContract {
  @prop()
  x: bigint;

  @prop()
  readonly y: bigint;

  @prop()
  static readonly z: bigint = 1000_000_000n;

  constructor(x: bigint, y: bigint) {
    super(x, y);
    this.x = x;
    this.y = y;
  }

  @method()
  public unlock(z: bigint) {
    const a = 1000_0000_00n;
    this.x = 1_000_0000_000n;
    assert(z == a, 'unlock failed');
  }
}
