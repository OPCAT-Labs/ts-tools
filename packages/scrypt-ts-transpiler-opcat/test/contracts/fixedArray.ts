import {
  method,
  prop,
  SmartContract,
  assert,
  FixedArray,
  fill,
  equals,
  ByteString,
  toByteString,
} from '@scrypt-inc/scrypt-ts-btc';

type FA1001 = FixedArray<bigint, 1001>;

type FA1 = FixedArray<bigint, 1>;

type FA1FA1001 = FixedArray<FA1, 1001>;

export class FixedArrayDemo extends SmartContract {
  @prop()
  fa1001: FA1001;

  @prop()
  fa1: FA1;

  @prop()
  fa1fa1001: FA1FA1001;

  constructor(fa1: FA1, fa1001: FA1001, fa1fa1001: FA1FA1001) {
    super(...arguments);
    this.fa1 = fa1;
    this.fa1001 = fa1001;
    this.fa1fa1001 = fa1fa1001;
  }

  @method()
  public unlock(z: bigint, fa1: FA1) {
    const as: FixedArray<ByteString, 2000> = fill(toByteString('01'), 2000);

    const ass: FixedArray<FA1, 2000> = fill(this.fa1, 2000);

    const fa: FixedArray<FixedArray<bigint, 1>, 1001> = fill([z] as FixedArray<bigint, 1>, 1001);

    assert(equals(fa1, this.fa1), 'check fa1 failed');

    assert(equals(fa, this.fa1fa1001), 'check fa1fa1001 failed');
    //assert(equals(fa1001, this.fa1001), 'check fa1fa1001 failed');
  }
}
