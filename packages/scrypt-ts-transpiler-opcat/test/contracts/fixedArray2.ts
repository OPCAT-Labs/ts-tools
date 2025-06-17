import { method, prop, SmartContract, assert, FixedArray, equals } from '@opcat-labs/scrypt-ts-opcat';

export class FixedArrayDemo2 extends SmartContract {
  static readonly N = 3;

  @prop()
  fa: FixedArray<bigint, typeof FixedArrayDemo2.N>;

  constructor(fa: FixedArray<bigint, typeof FixedArrayDemo2.N>) {
    super(...arguments);
    this.fa = fa;
  }

  @method()
  public unlock(z: bigint, fa: FixedArray<bigint, typeof FixedArrayDemo2.N>) {
    const faa: FixedArray<bigint, typeof FixedArrayDemo2.N> = [1n, 3n, 3n];
    assert(equals(this.fa, fa), 'check fa failed');
    assert(equals(this.fa, faa), 'check fa failed');
  }
}
