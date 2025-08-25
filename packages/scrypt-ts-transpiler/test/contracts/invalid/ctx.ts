import { method, SmartContract, assert } from '@opcat-labs/scrypt-ts';

export class InvalidCTX extends SmartContract {
  @method()
  public unlock(n: bigint) {
    const a = this.ctx;
    assert(n >= 0);
  }
}
