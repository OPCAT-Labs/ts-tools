import {
  assert,
  ByteString,
  equals,
  FixedArray,
  hash256,
  method,
  prop,
  SmartContract,
  toByteString,
} from '@opcat-labs/scrypt-ts-opcat';

export type ST11 = {
  x: bigint;
  y: boolean;
  z: ByteString;
};

export type ST12 = {
  x: FixedArray<bigint, 2>;
  ss: FixedArray<ST11, 2>;
  st1: ST11;
};

export type LocalPoint = {
  x: bigint;
  y: bigint;
};

export class Struct1 extends SmartContract {
  @prop()
  a: ST11;

  @prop()
  b: ST12;

  @prop()
  c: FixedArray<ST12, 1>;

  // ST11:
  @prop()
  static readonly ST: ST11 = {
    x: 23n,
    y: false,
    z: toByteString('23'),
  };

  @prop()
  static readonly Points: FixedArray<LocalPoint, 2> = [
    {
      x: 1n,
      y: 2n,
    },
    {
      x: 3n,
      y: 4n,
    },
  ];

  constructor(a: ST11, b: ST12, c: FixedArray<ST12, 1>) {
    super(a, b, c);
    this.a = a;
    this.b = b;
    this.c = c;
  }

  // Struct as return type
  @method()
  f1(): ST11 {
    return {
      x: 4n,
      y: true,
      z: toByteString('04'),
    };
  }

  // Struct as parameter
  @method()
  f2(st11: ST11): ST11 {
    return st11;
  }

  @method()
  public unlock() {
    this.a.x++;
    this.b.ss[0].x++;

    let st11: ST11 = {
      x: 1n,
      y: true,
      z: toByteString('00'),
    };

    st11 = {
      x: 3n,
      y: true,
      z: toByteString('01'),
    };

    assert(
      equals(st11, {
        x: 3n,
        y: true,
        z: toByteString('01'),
      }),
    );

    st11 = this.f1();

    assert(
      equals(st11, {
        x: 4n,
        y: true,
        z: toByteString('04'),
      }),
    );

    st11 = this.f2({
      x: 41n,
      y: false,
      z: toByteString('14'),
    });

    assert(
      equals(st11, {
        x: 41n,
        y: false,
        z: toByteString('14'),
      }),
    );

    assert(
      equals(Struct1.ST, {
        x: 23n,
        y: false,
        z: toByteString('23'),
      }),
    );

    assert(
      equals(Struct1.Points, [
        {
          x: 1n,
          y: 2n,
        },
        {
          x: 3n,
          y: 4n,
        },
      ]),
    );

    assert(true, 'shaOutputs check failed');
  }
}
