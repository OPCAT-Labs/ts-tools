import { assert, method, prop, SmartContract } from '@opcat-labs/scrypt-ts-opcat';

export class TypeNonSpecified extends SmartContract {
  @prop()
  a: bigint;

  constructor(a) {
    // invalid, all the parameters should have an explicit type
    super(...arguments);
    this.a = a;
  }

  @method()
  public unlock(b) {
    assert(b == 3n); // invalid
  }
}
