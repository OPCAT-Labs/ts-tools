import { assert, fill, method, SmartContract } from '@opcat-labs/scrypt-ts';

const M = 3;

export class InvalidFillFixedArray extends SmartContract {
  static readonly N = 3;

  @method()
  public unlock() {
    // good
    fill(1n, 3);

    // good
    fill(1n, M);

    // good
    fill(1n, InvalidFillFixedArray.N);

    // invalid, `p` is not a compiled-time constant
    const p = 3n;
    fill(1n, Number(p));

    assert(true);
  }
}
