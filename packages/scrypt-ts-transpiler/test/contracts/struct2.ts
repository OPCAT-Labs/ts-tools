import {
  method,
  prop,
  SmartContract,
  assert,
  FixedArray,
  equals,
  ByteString,
} from '@opcat-labs/scrypt-ts';

export type ST21 = {
  x: bigint;
  y: boolean;
  z: ByteString;
};

type LEN1 = 1;

type LEN2 = 2;
export type ST22 = {
  x: FixedArray<bigint, LEN2>;
  ss: FixedArray<ST21, LEN2>;
  st1: ST21;
};
export class Struct2 extends SmartContract {
  @prop()
  a: ST21;

  @prop()
  b: ST22;

  @prop()
  c: FixedArray<ST22, LEN1>;

  constructor(a: ST21, b: ST22, c: FixedArray<ST22, LEN1>) {
    super(a, b, c);
    this.a = a;
    this.b = b;
    this.c = c;
  }

  @method()
  public unlock(a: ST21, b: ST22, c: FixedArray<ST22, LEN1>) {
    assert(equals(a, this.a), 'struct `a` is not equal');
    assert(equals(b, this.b), 'struct `b` is not equal');
    assert(equals(c, this.c), 'struct `c` is not equal');
  }
}
