import { SmartContract, method, assert } from '@opcat-labs/scrypt-ts-opcat';

export class VoidReturn extends SmartContract {
  // Non-public methods can also return void type.
  @method()
  voidFunc(x: boolean): void {
    assert(x);
    return;
  }

  @method()
  public unlock() {
    const res = true;
    this.voidFunc(res);
    assert(res);
  }
}
