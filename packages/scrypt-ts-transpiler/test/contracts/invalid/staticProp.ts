import { assert, prop, method, SmartContract } from '@opcat-labs/scrypt-ts';

export class InvalidStaticProp extends SmartContract {
  @prop()
  static a; // invalid, static property shall be initialized when declared

  @prop()
  static a1 = 3n; // invalid, all `prop()` should be typed explicitly

  @prop()
  static readonly a2 = 3n; // invalid, all `prop()` should be typed explicitly

  @prop()
  static readonly b; // invalid, static property shall be initialized when declared

  @prop()
  static readonly c: bigint; // invalid, static property shall be initialized when declared

  @prop()
  static c1: bigint; // invalid, static property shall be initialized when declared

  @prop()
  static d: bigint = 1n; // valid

  @prop()
  static readonly d1: bigint = 1n; // valid
  @prop()
  static readonly e2 = 1n + 2n; // invalid, all `prop()` should be typed explicitly

  @prop()
  static readonly e3: bigint = 1n + 2n; //valid

  static readonly f1: bigint; // valid, but throw when referenced

  static readonly f2 = 1n; // valid, can be referenced

  static readonly f3 = 1n + 1n; // valid, can be referenced

  @method()
  public unlock() {
    assert(InvalidStaticProp.f1 == 1n); // invalid, Cannot access Non-Prop property 'f1' in a `@method()` function
    assert(InvalidStaticProp.f2 == 1n); // valid, f2 is ctc
    assert(InvalidStaticProp.f3 == 2n); // valid, f3 is ctc
    assert(InvalidStaticProp.d == 1n);
    assert(true);
  }
}
