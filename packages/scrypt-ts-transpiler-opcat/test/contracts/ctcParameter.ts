import {
  FixedArray,
  SmartContract,
  assert,
  method,
  fill,
  equals,
  ByteString,
  toByteString,
} from '@scrypt-inc/scrypt-ts-btc';

const M = 2;

export class CtcParameter extends SmartContract {
  @method()
  sum(a: number): FixedArray<bigint, typeof a> {
    const f: FixedArray<bigint, 3> = fill(1n, 3);

    const fa: FixedArray<FixedArray<bigint, 2>, 3> = fill(fill(1n, 2), 3);

    const as: FixedArray<ByteString, 10> = fill(toByteString('01'), 10);

    const arrf: FixedArray<bigint, 3> = [1n, 2n, 3n]; // valid

    const fb: FixedArray<bigint, typeof a> = fill(1n, a);

    const faa: FixedArray<FixedArray<bigint, typeof a>, typeof a> = fill(fill(1n, a), a);

    const faa3: FixedArray<FixedArray<bigint, 3>, typeof a> = fill(fill(1n, 3), a);

    const ee: FixedArray<FixedArray<bigint, 2>, 3> = fill(fill(1n, 2), 3);

    let sum = 0n;
    for (let i = 0; i < a; i++) {
      sum += BigInt(i);
      fb[i] = sum;
    }
    return fb;
  }

  @method()
  public unlock() {
    assert(equals(this.sum(M), [1n, 1n]));
  }
}
