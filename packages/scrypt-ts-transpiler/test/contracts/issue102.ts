import { assert, method, prop, SmartContract } from '@opcat-labs/scrypt-ts';

export class Issue102 extends SmartContract {
  @prop()
  a: bigint;

  constructor(a: bigint) {
    super(a);
    this.a = a;
  }

  @method()
  public unlock(a: bigint) {
    // should auto append SighashPreimage for the public method if access state property.
    this.a = a + 1n;
    assert(this.a == 3n);
  }
}
