import { method, prop, assert } from '@opcat-labs/scrypt-ts';

import { BaseDemo } from './basedemo';

export class HeritageDemo1 extends BaseDemo {
  @prop()
  readonly z: bigint;

  constructor(x: bigint, y: bigint, z: bigint) {
    super(x, y);
    this.z = z;
  }

  @method()
  public unlock(z: bigint) {
    let _z = BaseDemo.sum(this.x, this.y);
    _z = HeritageDemo1.sum(_z, this.z);
    assert(z == _z, 'add check failed');
  }
}
