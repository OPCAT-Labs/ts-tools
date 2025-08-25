import { assert, method, prop, SmartContract } from '@opcat-labs/scrypt-ts';

export class CtorWithNonProp extends SmartContract {
  a: bigint;

  @prop()
  b: bigint;

  constructor(a: bigint, b: bigint) {
    super(a, b);
    this.a = a;
    this.b = b;
  }

  @method()
  public unlock(b: bigint) {
    assert(this.b == b, 'this.b != b');
  }
}
