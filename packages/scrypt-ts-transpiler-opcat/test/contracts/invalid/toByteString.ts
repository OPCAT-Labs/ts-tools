import { assert, method, SmartContract, toByteString } from '@opcat-labs/scrypt-ts-opcat';

export class ToByteString extends SmartContract {
  @method()
  public unlock() {
    toByteString('hello', 1 === 1); // invalid, not passing boolean literal to the 2nd parameter

    const a = true;
    toByteString('world', a); // invalid, not passing boolean literal to the 2nd parameter

    const b = toByteString('hello world', true); // valid

    const c = toByteString(b, true); // invalid, not passing string literal to the 1st parameter

    toByteString('0011', false); // valid
    toByteString('0011'); // valid

    toByteString('001'); // invalid, `001` is not a valid hex literal

    toByteString('hello', false); // invalid, `hello` is not a valid hex literal

    assert(true);
  }
}
