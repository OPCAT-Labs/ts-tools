import { assert, method, SmartContract } from '@scrypt-inc/scrypt-ts-btc';

export class Recursion2 extends SmartContract {
  // This contract should cause error.
  // Recursion A -> B -> C -> A

  @method()
  c(x: bigint): bigint {
    return x + this.a(x);
  }

  @method()
  b(x: bigint): bigint {
    return x + this.c(x);
  }

  @method()
  a(x: bigint): bigint {
    let res = x;
    if (x >= 16) {
      res = x + this.b(x);
    }
    return res;
  }

  @method()
  public unlock(x: bigint) {
    assert(this.a(x) == 16n);
  }
}
