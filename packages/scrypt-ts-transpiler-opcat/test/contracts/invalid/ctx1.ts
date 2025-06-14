import { assert, ByteString, method, SmartContract } from '@scrypt-inc/scrypt-ts-btc';

export class CTX1 extends SmartContract {
  // foo not called in any public method
  @method()
  foo(): ByteString {
    return this.ctx.spentAmount;
  }

  @method()
  public unlock() {
    assert(true);
  }
}
