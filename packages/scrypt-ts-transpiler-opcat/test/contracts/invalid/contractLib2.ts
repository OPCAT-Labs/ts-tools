import {
  assert,
  method,
  prop,
  SHPreimage,
  SmartContract,
  SmartContractLib,
} from '@opcat-labs/scrypt-ts-opcat';

export class ContractLib2 extends SmartContractLib {
  @prop()
  a: bigint;

  constructor(a: bigint) {
    super(...arguments);
    this.a = a;
  }

  // invalid, functions in SmartContractLib cannot have parameters of type `SmartContract`
  @method()
  static myCheckPreimage(txPreimage: SHPreimage, contractCtx: SmartContract): boolean {
    return contractCtx.checkSHPreimage(txPreimage);
  }

  @method()
  add(x: bigint, y: bigint): bigint {
    return x + y + this.a;
  }
}

export class ContractLibWrapper2 extends SmartContract {
  @prop()
  lib: ContractLib2;

  constructor(lib: ContractLib2) {
    super(...arguments);
    this.lib = lib;
  }

  @method()
  public unlock() {
    assert(true);
  }
}
