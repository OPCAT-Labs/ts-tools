import { prop, method, assert } from '@opcat-labs/scrypt-ts-opcat';
import { DemoBase } from './demobase';

export class HeritageDemoInvalid4 extends DemoBase {
  @prop()
  readonly x: bigint;

  constructor(x: bigint, y: bigint) {
    super(x, y);
    this.x = 9n;
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
  public unlock(z: bigint) {
    assert(z == this.x + this.y, 'add check failed');
  }
}
