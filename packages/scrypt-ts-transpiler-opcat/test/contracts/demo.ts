import { SmartContract, prop, method, assert } from '@opcat-labs/scrypt-ts-opcat';

export class Demo extends SmartContract {
  @prop()
  readonly x: bigint;

  @prop()
  readonly y: bigint;

  constructor(x: bigint, y: bigint) {
    super(x, y);
    this.x = x;
    this.y = y;
  }

  @method()
  static sum(a: bigint, b: bigint): bigint {
    return a + b;
  }

  @method()
  xyDiff(): bigint {
    return this.x - this.y;
  }

  @method()
  public add(z: bigint) {
    assert(z == Demo.sum(this.x, this.y), 'add check failed');
  }

  @method()
  public sub(z: bigint) {
    assert(z == this.xyDiff(), 'sub check failed');
  }
}
