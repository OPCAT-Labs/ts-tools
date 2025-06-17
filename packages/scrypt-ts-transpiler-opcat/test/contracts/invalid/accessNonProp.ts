import { assert, method, prop, SmartContract } from '@opcat-labs/scrypt-ts-opcat';

export class AccessNonProp extends SmartContract {
  a: bigint;

  @prop()
  b: bigint;

  constructor(a: bigint, b: bigint) {
    super(a, b);
    this.a = a;
    this.b = b;
  }

  @method()
  public unlock(a: bigint) {
    assert(this.bar(a));
    assert(this.a == a); // invalid, cannot access Non-Prop property in a `@method()` function
  }

  @method()
  bar(a: bigint): boolean {
    return this.a == a; // invalid
  }
}
