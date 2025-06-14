import { method, SmartContract, assert } from '@scrypt-inc/scrypt-ts-btc';

export class InvalidCTX extends SmartContract {
  @method()
  public unlock(n: bigint) {
    const a = this.ctx;
    assert(n >= 0);
  }
}
