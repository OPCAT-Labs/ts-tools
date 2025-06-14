import { assert, prop, method, SmartContract } from '@scrypt-inc/scrypt-ts-btc';

export class StaticProp extends SmartContract {
  @prop()
  static d: bigint = 1n;

  @prop()
  static readonly d1: bigint = 2n;

  static readonly d2 = 3n;
  static readonly d3 = 4;

  @method()
  public unlock() {
    assert(StaticProp.d == 1n);
    assert(StaticProp.d1 == 2n);
    assert(StaticProp.d2 == 3n);
    assert(StaticProp.d3 == 4);
  }
}
