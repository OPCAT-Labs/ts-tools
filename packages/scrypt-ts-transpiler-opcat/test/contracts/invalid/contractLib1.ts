import { assert, method, prop, SmartContract, SmartContractLib } from '@scrypt-inc/scrypt-ts-btc';

export class ContractLib1 extends SmartContractLib {
  // invalid, `@prop(true)` is only not allowed to be used in `SmartContractLib`
  @prop()
  a: bigint;

  constructor(a: bigint) {
    super(...arguments);
    this.a = a;
  }

  // invalid, `@method` in `SmartContractLib` should not be declared as `public`
  @method()
  public unlock() {
    assert(true);
  }
}

export class ContractLibWrapper1 extends SmartContract {
  @prop()
  lib: ContractLib1;

  constructor(lib: ContractLib1) {
    super(...arguments);
    this.lib = lib;
  }

  @method()
  public unlock() {
    assert(true);
  }
}
