import { method, prop, SmartContract, assert } from '@opcat-labs/scrypt-ts';

enum EnumExample {
  ONE = 1,
  TWO = 2,
  THREE = 3,

  FOUR = 10,
  FIVE,
}

export class EnumC extends SmartContract {
  @prop()
  a: EnumExample;

  constructor(a: EnumExample) {
    super(...arguments);
    this.a = a;
  }

  @method()
  sum(a: number): bigint {
    let ret = 0n;
    for (let i = 0; i < a; i++) {
      ret += 1n;
    }
    return ret;
  }

  @method()
  public add(z: bigint) {
    let a = 1n;
    if (this.a === EnumExample.ONE) {
      a++;
    } else if (z === BigInt(EnumExample.TWO)) {
      a += 2n;
    } else if (z === BigInt(EnumExample.THREE)) {
      a += this.sum(EnumExample.THREE);
    } else {
      a = -1n;
    }
    assert(a > 0n, 'a invalid');
  }
}
