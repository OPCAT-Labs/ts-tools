import { assert, method, prop, SmartContract } from '@scrypt-inc/scrypt-ts-btc';

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
