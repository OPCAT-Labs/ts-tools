import { assert, method, prop, SmartContract } from '@opcat-labs/scrypt-ts';

export class Constructor2 extends SmartContract {
  a: bigint;

  @prop()
  b: bigint;

  constructor(a: bigint, b: bigint) {
    // invalid
    // should pass all the arguments of constructor to `super`
    // and in the same order as they are passed into the constructor
    super(b, a);

    // other invalid cases
    //
    // super();
    // super(a);

    // valid
    //
    // super(a, b);

    // valid, and recommended
    //
    // super(...arguments);

    this.a = a;
    this.b = b;
  }

  @method()
  public unlock() {
    assert(true);
  }
}
