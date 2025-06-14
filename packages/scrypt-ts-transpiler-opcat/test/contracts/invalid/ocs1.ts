import { method, prop, SmartContract, assert } from '@scrypt-inc/scrypt-ts-btc';

export class OCS1 extends SmartContract {
  @method()
  static sum(a: bigint, b: bigint): bigint {
    return a + b;
  }

  @method()
  xyDiff(x: bigint): bigint {
    this.insertCodeSeparator();
    return 2n * x;
  }

  @method()
  public add(z: bigint) {
    assert(z == OCS1.sum(1n, 2n), 'add check failed');
  }
}
