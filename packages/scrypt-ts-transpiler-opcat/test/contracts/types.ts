import {
  assert,
  ByteString,
  equals,
  FixedArray,
  method,
  OpCode,
  OpCodeType,
  PrivKey,
  prop,
  PubKey,
  PubKeyHash,
  Ripemd160,
  Sha1,
  Sha256,
  SHPreimage,
  Sig,
  SmartContract,
  toByteString,
} from '@opcat-labs/scrypt-ts-opcat';

interface W {
  x: bigint;
  y: P<boolean>;
}

type WW = W;
type WWW = WW;
type WWT<T> = T;
type S = {
  x: bigint;
};
type Q = S;
type SSS = Q;
type X = FixedArray<bigint, 2>;
type P<T> = FixedArray<T, 2>;
type S2 = P<bigint>;
type V = FixedArray<WWT<WWW>, 2>;
type LONG_ARR = FixedArray<FixedArray<bigint, typeof Types.LONG_LEN>, 2>;

export class Types extends SmartContract {
  // its type is literal type `90`, and it should not be declared as `number` because it's referred as `typeof Types.LONG_LEN` in another type.
  static readonly LONG_LEN = 90;

  @prop()
  x: boolean;

  @prop()
  y: bigint;

  @prop()
  b: ByteString;

  @prop()
  pubkey: PubKey;

  @prop()
  key: PrivKey;

  @prop()
  sig: Sig;

  @prop()
  txPreimage: SHPreimage;

  @prop()
  ripemd160: Ripemd160;

  @prop()
  pkh: PubKeyHash;

  @prop()
  sha256: Sha256;

  @prop()
  sha1: Sha1;

  @prop()
  opCodeType: OpCodeType;

  constructor(
    x: boolean,
    y: bigint,
    eb: ByteString,
    pubkey: PubKey,
    key: PrivKey,
    sig: Sig,
    ripemd160: Ripemd160,
    pkh: PubKeyHash,
    sha256: Sha256,
    sha1: Sha1,
    opCodeType: OpCodeType,
    sh: SHPreimage,
  ) {
    super(...arguments);

    this.x = true;
    this.y = 1111n;
    this.b = toByteString('0011');

    this.pubkey = PubKey(
      toByteString('027fb1357e10d186ca7637927e3b71247e69d3d3f97c187292fc5a5eac7e67d09b'),
    );

    this.key = PrivKey(11111n);

    this.key = PrivKey(0x3322afn);

    this.txPreimage = sh;
    this.ripemd160 = Ripemd160(toByteString('c7476f57aabd2952d3cef671dd9930585bc3ac8b'));
    this.pkh = PubKeyHash(toByteString('c7476f57aabd2952d3cef671dd9930585bc3ac8b'));

    this.sha256 = Sha256(
      toByteString('87dff33400ebf55af345a5a03fe0dc36ba9073c25e67dccef34a46dc1b165994'),
    );
    this.sha1 = Sha1(
      toByteString('87dff33400ebf55af345a5a03fe0dc36ba9073c25e67dccef34a46dc1b165994'),
    );

    this.opCodeType = OpCode.OP_0;

    this.opCodeType = OpCode.OP_1;

    this.opCodeType = OpCodeType(toByteString('00'));

    this.opCodeType = OpCodeType(toByteString('01'));
    this.sig = Sig(toByteString('0001'));
  }

  @method()
  public unlock(pubkey: PubKey, sig: Sig) {
    const p: PubKey = PubKey(
      toByteString('027fb1357e10d186ca7637927e3b71247e69d3d3f97c187292fc5a5eac7e67d09b'),
    );

    const key_a: PrivKey = PrivKey(12n);

    const key_b: PrivKey = PrivKey(12n);

    const a = 2n;
    const a1 = toByteString('12', true);
    const a2 = false;
    const a3: boolean = false;
    const a4: ByteString = toByteString('123', true);
    const a5: bigint = 3n;
    const a6: boolean = true;
    const a7: ByteString = toByteString('1234', false);
    const a8: bigint = 4n;
    const a9 = 3n;
    const a10: bigint = 4n;
    const a11: bigint = 5n;
    const a12: ByteString = toByteString('1234');

    const st1: S = { x: 2n };
    const st2: S2 = [1n, 2n];
    const st3: WWW = { x: 2n, y: [true, false] };
    const st4: SSS = { x: 2n };
    const st5: WWT<WWW> = { x: 2n, y: [true, false] };

    const arr1: FixedArray<ByteString, 2> = [
      toByteString('true', true),
      toByteString('false', true),
    ];
    const arr2: FixedArray<boolean, 2> = [true, false];
    const arr3: X = [1n, 2n];
    const arr4: FixedArray<bigint, 3> = [1n, 2n, 3n];
    const arr5: FixedArray<FixedArray<bigint, 2>, 3> = [
      [1n, 2n],
      [1n, 2n],
      [1n, 2n],
    ];
    assert(
      equals(arr5, [
        [1n, 2n],
        [1n, 2n],
        [1n, 2n],
      ]),
      'arr5 check failed',
    );
    const arr6: FixedArray<V, 2> = [
      [
        { x: 2n, y: [true, false] },
        { x: 2n, y: [true, false] },
      ],
      [
        { x: 2n, y: [true, false] },
        { x: 2n, y: [true, false] },
      ],
    ];
    const arr7: LONG_ARR = [
      [
        0n,
        1n,
        2n,
        3n,
        4n,
        5n,
        6n,
        7n,
        8n,
        9n,
        10n,
        11n,
        12n,
        13n,
        14n,
        15n,
        16n,
        17n,
        18n,
        19n,
        20n,
        21n,
        22n,
        23n,
        24n,
        25n,
        26n,
        27n,
        28n,
        29n,
        30n,
        31n,
        32n,
        33n,
        34n,
        35n,
        36n,
        37n,
        38n,
        39n,
        40n,
        41n,
        42n,
        43n,
        44n,
        45n,
        46n,
        47n,
        48n,
        49n,
        50n,
        51n,
        52n,
        53n,
        54n,
        55n,
        56n,
        57n,
        58n,
        59n,
        60n,
        61n,
        62n,
        63n,
        64n,
        65n,
        66n,
        67n,
        68n,
        69n,
        70n,
        71n,
        72n,
        73n,
        74n,
        75n,
        76n,
        77n,
        78n,
        79n,
        80n,
        81n,
        82n,
        83n,
        84n,
        85n,
        86n,
        87n,
        88n,
        89n,
      ],
      [
        0n,
        1n,
        2n,
        3n,
        4n,
        5n,
        6n,
        7n,
        8n,
        9n,
        10n,
        11n,
        12n,
        13n,
        14n,
        15n,
        16n,
        17n,
        18n,
        19n,
        20n,
        21n,
        22n,
        23n,
        24n,
        25n,
        26n,
        27n,
        28n,
        29n,
        30n,
        31n,
        32n,
        33n,
        34n,
        35n,
        36n,
        37n,
        38n,
        39n,
        40n,
        41n,
        42n,
        43n,
        44n,
        45n,
        46n,
        47n,
        48n,
        49n,
        50n,
        51n,
        52n,
        53n,
        54n,
        55n,
        56n,
        57n,
        58n,
        59n,
        60n,
        61n,
        62n,
        63n,
        64n,
        65n,
        66n,
        67n,
        68n,
        69n,
        70n,
        71n,
        72n,
        73n,
        74n,
        75n,
        76n,
        77n,
        78n,
        79n,
        80n,
        81n,
        82n,
        83n,
        84n,
        85n,
        86n,
        87n,
        88n,
        89n,
      ],
    ];

    const sighashNew: ByteString = a12 + a4 + arr1[0];
    const sighashNew1 = a12 + a4 + arr1[0];

    assert(sighashNew == sighashNew1, 'sighashNew != sighashNew1');

    const p1 = toByteString('0101') + p;
    assert(
      p1 == toByteString('0101027fb1357e10d186ca7637927e3b71247e69d3d3f97c187292fc5a5eac7e67d09b'),
      'p1 wrong',
    );

    assert(key_a == key_b, 'key_a != key_b');
    assert(this.x == false, '`x` is not false');
  }
}
