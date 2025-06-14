import { method, SmartContract, assert } from '@scrypt-inc/scrypt-ts-btc';

// calling another public method which has access to ctx is not allowed

export class InvalidCtx2 extends SmartContract {
  @method()
  public unlock() {
    this.f1();
    assert(true);
  }
  @method()
  public f1() {
    const a = this.ctx.nVersion;
  }
}
