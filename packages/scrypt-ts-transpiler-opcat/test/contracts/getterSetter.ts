import { assert, method, SmartContract } from '@scrypt-inc/scrypt-ts-btc';

export class GetterSetter extends SmartContract {
  private _s: bigint = 1n;

  get g(): bigint {
    return 1n;
  }

  set s(s: bigint) {
    this._s = s;
  }

  @method()
  public unlock() {
    assert(true);
  }
}
