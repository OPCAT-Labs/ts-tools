import { assert, method, prop, SmartContract } from '@scrypt-inc/scrypt-ts-btc';

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
