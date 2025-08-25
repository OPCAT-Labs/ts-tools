import { method, prop, assert } from '@opcat-labs/scrypt-ts';

import { BaseDemo } from './basedemo';

export class HeritageDemo2 extends BaseDemo {
  @prop()
  readonly z: bigint;

  constructor(x: bigint, z: bigint) {
    super(x, 2n);
    ///this.init(x, y, z);
    this.z = z;
  }

  @method()
  public unlock(z: bigint) {
    let _z = BaseDemo.sum(this.x, this.y);
    _z = HeritageDemo2.sum(_z, this.z);
    assert(z == _z, 'add check failed');
  }
}
