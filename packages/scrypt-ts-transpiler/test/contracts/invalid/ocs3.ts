import { method, prop, SmartContract, assert } from 'scrypt-ts';

export class OCS3 extends SmartContract {
  @method()
  public add(z: bigint) {
    this.insertCodeSeparator();

    assert(z == 1n, 'add check failed');
  }

  @method()
  public sub(z: bigint) {
    this.insertCodeSeparator();

    assert(z == 1n, 'sub check failed');
  }
}
