import { method, prop, SmartContract, assert } from '@opcat-labs/scrypt-ts-opcat';

enum EnumExample {
  ONE = 1,
  TWO = '01',
  THREE = 3,
}

export class InvalidEnumC extends SmartContract {
  constructor() {
    super();
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
    if (z === BigInt(EnumExample.ONE)) {
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
