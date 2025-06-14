import { assert, FixedArray, method, SmartContract } from '@scrypt-inc/scrypt-ts-btc';

type A = 3; // valid
const B = 3; // valid
const C = 2 + B - 2; // valid

const D: number = 3; // invalid

export class Ctc extends SmartContract {
  static readonly E = 3; // valid
  static readonly G = 2 + Ctc.E - 2; // valid

  static readonly F: number = 3; //  invalid

  @method()
  public unlock() {
    const arr: FixedArray<bigint, 3> = [1n, 2n, 3n]; // valid

    const a: FixedArray<bigint, A> = [1n, 2n, 3n]; // valid

    const b: FixedArray<bigint, typeof B> = [1n, 2n, 3n]; // valid

    const c: FixedArray<bigint, typeof C> = []; // invalid

    const d: FixedArray<bigint, typeof D> = []; // invalid

    const e: FixedArray<bigint, typeof Ctc.E> = [1n, 2n, 3n]; // valid

    const f: FixedArray<bigint, typeof Ctc.F> = []; // invalid

    const g: FixedArray<bigint, typeof Ctc.G> = []; // invalid

    assert(true);
  }
}
