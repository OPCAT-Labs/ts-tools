import { assert, method, SmartContract } from '@scrypt-inc/scrypt-ts-btc';

export class Recursion extends SmartContract {
  // This method should cause error.
  @method()
  factorial(x: bigint): bigint {
    let res = 1n;
    if (x > 0n) {
      res = x * this.factorial(x - 1n);
    }
    return res;
  }

  @method()
  public unlock(x: bigint) {
    assert(this.factorial(x) == 5n, 'fact(x) != 5');
  }
}
