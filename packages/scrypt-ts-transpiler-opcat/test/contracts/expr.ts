import {
  method,
  prop,
  SmartContract,
  assert,
  toByteString,
  hash160,
  FixedArray,
  ByteString,
} from '@opcat-labs/scrypt-ts-opcat';

type STT = {
  a: bigint;
  b: boolean;
  st: STS;
};

type STS = {
  X: bigint;
  Y: boolean;
};

export class Expr extends SmartContract {
  @prop()
  x: bigint;

  constructor(x: bigint) {
    super(x);
    this.x = x;
  }

  @method()
  cloneSSS(sss: STS): STS {
    return sss;
  }

  @method()
  cloneST(st: STT): STT {
    return st;
  }

  @method()
  public unlock(z: bigint) {
    //BoolLiteral
    true;
    false;

    //IntLiteral
    111n;
    0x333n;

    //BytesLiteral
    const bb: ByteString = toByteString('68656c6c6f20776f726c64');

    const s2 = toByteString('hello world', true);

    assert(bb == s2);

    //Var

    this.x = z;

    //: ArrayLiteral

    [1n, 3n, 3n, 5n];

    [true, false, true, false];

    [toByteString('00'), toByteString('1110'), toByteString('2233fa'), toByteString('0ee0')];

    const aaa: FixedArray<bigint, 3> = [1n, 3n, 3n];

    const abb: FixedArray<FixedArray<bigint, 2>, 3> = [
      [1n, 3n],
      [1n, 3n],
      [1n, 3n],
    ];

    const bbb: FixedArray<FixedArray<FixedArray<bigint, 1>, 2>, 3> = [
      [[1n], [1n]],
      [[1n], [1n]],
      [[1n], [1n]],
    ];

    const i: bigint = 2n;
    aaa[Number(i)];

    const ass: FixedArray<STT, 2> = [
      {
        b: true,
        a: 1n,
        st: {
          Y: false,
          X: 1n,
        },
      },
      {
        b: true,
        a: 1n,
        st: {
          Y: false,
          X: 1n,
        },
      },
    ];

    // StructLiteral

    const ss: STT = {
      b: true,
      a: 1n,
      st: {
        Y: false,
        X: 1n,
      },
    };

    const st: STT = this.cloneST({
      a: 1n,
      b: true,
      st: {
        X: 1n,
        Y: false,
      },
    });

    const ssss: STS = this.cloneSSS({
      Y: true,
      X: 1n,
    });

    // Slice
    //bb = slice(bb, 0n, 3n);

    //UnaryExpr

    !false;
    let a: bigint = 1n;
    a++;

    //BinaryExpr
    a = 3n;

    //TernaryExpr

    1n == a ? true : false;

    //Call
    hash160(bb);

    // Parens

    a = 1n + 3n + 3n + a;

    assert(z == 1n, 'z not equals 1n');
  }
}
