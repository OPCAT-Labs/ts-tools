import {
  assert,
  ByteString,
  equals,
  fill,
  FixedArray,
  method,
  SmartContract,
  toByteString,
} from '@opcat-labs/scrypt-ts-opcat';

interface St {
  a: bigint;
  b: ByteString;
}

export class FillFixedArray extends SmartContract {
  @method()
  public unlock() {
    const a: FixedArray<bigint, 3> = [1n, 1n, 1n];
    const b: FixedArray<bigint, 3> = fill(1n, 3);
    assert(equals(a, b));

    const c: FixedArray<FixedArray<bigint, 3>, 2> = [
      [1n, 1n, 1n],
      [1n, 1n, 1n],
    ];
    const d: FixedArray<FixedArray<bigint, 3>, 2> = fill(b, 2);
    assert(equals(c, d));

    const e: St = { a: 1n, b: toByteString('') };
    const f: FixedArray<St, 2> = [e, e];
    const g: FixedArray<St, 2> = fill(e, 2);
    assert(equals(f, g));

    const h: FixedArray<FixedArray<FixedArray<bigint, 4>, 3>, 2> = [
      [
        [1n, 1n, 1n, 1n],
        [1n, 1n, 1n, 1n],
        [1n, 1n, 1n, 1n],
      ],
      [
        [1n, 1n, 1n, 1n],
        [1n, 1n, 1n, 1n],
        [1n, 1n, 1n, 1n],
      ],
    ];
    const i: FixedArray<FixedArray<FixedArray<bigint, 4>, 3>, 2> = fill(fill(fill(1n, 4), 3), 2);
    assert(equals(h, i));
  }
}
