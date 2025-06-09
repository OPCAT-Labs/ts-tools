import { method, prop, assert } from '../../src/index.js';
import { Demo } from './demo.js';

export class HeritageDemo extends Demo {
  @prop()
  readonly z: bigint;

  constructor(x: bigint, y: bigint) {
    super(x, y);
    this.z = 1n;
  }

  @method()
  public unlock(z: bigint) {
    let _z = HeritageDemo.sum(this.x, this.y);
    _z = HeritageDemo.sum(_z, this.z);
    assert(z == _z, 'add check failed');
  }
}
