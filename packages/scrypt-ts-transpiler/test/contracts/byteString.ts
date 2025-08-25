import { assert, ByteString, method, SmartContract, toByteString } from '@opcat-labs/scrypt-ts';

export class ByteStringTest extends SmartContract {
  @method()
  public unlock() {
    const str0: ByteString = toByteString('01ab23ef'); // === '01ab23ef'
    const str1: ByteString = toByteString('hello world', true); // === '68656c6c6f20776f726c64' (utf-8)
    const str2: ByteString = toByteString('68656c6c6f20776f726c64'); // === '68656c6c6f20776f726c64'
    const str3: ByteString = toByteString('Hello "sCrypt"', true); // === '48656c6c6f202273437279707422' (utf-8)
    const str4: ByteString = toByteString('48656c6c6f202273437279707422'); // === '48656c6c6f202273437279707422'

    // Compare.
    assert(str1 == str2);
    assert(str1 === str2);
    assert(str1 === str2);
    assert(str0 != str1);
    assert(str0 !== str1);
    assert(str3 == str4);

    // Concat.
    assert(str0 + str1 == toByteString('01ab23ef68656c6c6f20776f726c64'));
  }
}
