import { assert, method, prop, SmartContract } from '@opcat-labs/scrypt-ts';

export class PropInitialization1 extends SmartContract {
  @prop()
  a: bigint;

  constructor() {
    super();

    // invalid, property `a` must be initialized in the constructor
  }

  @method()
  public unlock() {
    assert(true);
  }
}
