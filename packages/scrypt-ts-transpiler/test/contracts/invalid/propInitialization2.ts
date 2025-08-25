import { assert, method, prop, SmartContract } from '@opcat-labs/scrypt-ts';

export class PropInitialization2 extends SmartContract {
  @prop()
  a: bigint = 1n; // invalid, property `a` shall only be initialized in the constructor

  constructor(a: bigint) {
    super(...arguments);
    this.a = a;
  }

  @method()
  public unlock() {
    assert(true);
  }
}
