import { method, prop, SmartContract, assert } from '@scrypt-inc/scrypt-ts-btc';

export class OCS2 extends SmartContract {
  @method()
  public add(z: bigint) {
    if (z > 1n) {
      const i = 1n;
    } else {
      this.insertCodeSeparator();
    }

    assert(z == 1n, 'add check failed');
  }
}
