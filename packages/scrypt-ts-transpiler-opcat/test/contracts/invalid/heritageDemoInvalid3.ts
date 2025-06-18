import { prop, method } from '@opcat-labs/scrypt-ts-opcat';
import { DemoBase } from './demobase';

export class HeritageDemoInvalid3 extends DemoBase {
  @prop()
  readonly z: bigint;

  constructor(x: bigint, y: bigint, z: bigint) {
    super(x, y);
    this.z = z;
  }

  @method()
  static sum(a: bigint, b: bigint): bigint {
    return a + b;
  }
}
