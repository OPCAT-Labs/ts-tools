import {
  SmartContract,
  prop,
  method,
  ByteString,
  FixedArray,
  Bool,
  assert,
  Int32,
  SmartContractLib,
} from '@opcat-labs/scrypt-ts-opcat';

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

class STLib extends SmartContractLib {
  @prop()
  y: bigint

  @prop()
  x: ByteString

  constructor(x: ByteString, y: bigint) {
    super(x, y);
    this.x = x;
    this.y = y;
  }


  @method()
  getX(): ByteString {
    return this.x;
  }
}

export class StateTest extends SmartContract<A> {
  @prop()
  x: bigint;

  @prop()
  y: C;

  constructor(x: bigint, y: C) {
    super(x, y);
    this.x = x;
    this.y = y;
  }

  @method()
  public unlock(z: bigint, y: Bool) {
    const a: Bool = false;
    assert(a);
    this.state;
    assert(this.x === z && y, 'x is not equal to z');
  }
}
