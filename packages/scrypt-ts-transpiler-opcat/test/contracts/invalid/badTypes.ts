import { assert, method, prop, SmartContract, toByteString } from '@opcat-labs/scrypt-ts-opcat';

export class BadTypes extends SmartContract {
  @prop()
  a: number; // invalid, only compile-time constants can have a type of `number`

  @prop()
  b: string; // invalid, cannot have a property with type `string`, using `ByteString` instead
  @prop()
  c: string; // invalid, cannot have a property with type `String`, either

  @prop()
  d: number; // invalid, cannot have a property with type `Number`, either

  constructor(a: number, b: string, c: string, d: number) {
    super(...arguments);
    this.a = a;
    this.b = b;
    this.c = c;
    this.d = d;
  }

  @method()
  public unlock() {
    const e0 = { x: 1n }; // invalid, inferred object literal type is untransformable
    const e1: { x: bigint } = { x: 1n }; // invalid, declared object literal type is untransformable
    const e2: Array<number> = [1, 2]; // invalid, declared Array type is untransformable
    const e3 = [1, 2]; // invalid, inferred Array type is untransformable

    const s1 = 'hello world'; // assignment with literal string directly is invalid, must use `toByteString("hello world", true)`
    const s2 = '68656c6c6f20776f726c64'; // assignment with hex string directly is invalid, must use `toByteString("68656c6c6f20776f726c64")`

    const s3: string = toByteString('00'); // convert `ByteString` to `string` is invalid

    const b = true ? 1n : 3n; // missing explicitly declared type.

    assert(true);
  }
}
