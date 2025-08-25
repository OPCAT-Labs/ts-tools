import { assert, ByteString, method, SmartContract } from '@opcat-labs/scrypt-ts';

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
