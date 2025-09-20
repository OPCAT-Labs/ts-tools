import { assert, ByteString, method, SmartContract, UInt64 } from '@opcat-labs/scrypt-ts-opcat';

export class CTX1 extends SmartContract {
  // foo not called in any public method
  @method()
  foo(): UInt64 {
    return this.ctx.value;
  }

  @method()
  public unlock() {
    assert(true);
  }
}
