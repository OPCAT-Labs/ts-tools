import { method, prop, SmartContractLib } from '@opcat-labs/scrypt-ts-opcat';

export type SS = {
  a: bigint;
};

export class Lib extends SmartContractLib {
  @prop()
  x: bigint;

  constructor(x: bigint) {
    super(x);
    this.x = x;
  }

  @method()
  add(x: bigint, y: bigint): bigint {
    const a: SS = {
      a: 1n,
    };

    return x + y + this.x;
  }
}
