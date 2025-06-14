import {
  SmartContract,
  prop,
  method,
  ByteString,
  FixedArray,
  Bool,
  assert,
  Int32,
} from '@scrypt-inc/scrypt-ts-btc';

type A = {
  a: FixedArray<Int32, 3>;
  b: B;
};

type B = {
  c: FixedArray<Bool, 2>;
  d: FixedArray<C, 2>;
};

type C = {
  e: ByteString;
  f: FixedArray<Bool, 2>;
};

export class StateTest extends SmartContract<A> {
  @prop()
  x: bigint;

  constructor(x: bigint) {
    super(x);
    this.x = x;
  }

  @method()
  public unlock(z: bigint, y: Bool) {
    const a: Bool = false;
    assert(a);
    this.state;
    assert(this.x === z && y, 'x is not equal to z');
  }
}
