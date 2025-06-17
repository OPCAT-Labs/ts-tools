import { BaseDemo } from './basedemo';

import { method, prop, assert } from '@opcat-labs/scrypt-ts-opcat';

export class HeritageDemo extends BaseDemo {
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
