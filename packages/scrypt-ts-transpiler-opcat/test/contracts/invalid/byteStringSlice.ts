import { assert, method, SmartContract, toByteString } from '@opcat-labs/scrypt-ts-opcat';

export class ByteStringSlice extends SmartContract {
  @method()
  public unlock() {
    const b = toByteString('00112233');

    assert(b.slice(2, 4) == toByteString('00')); // invalid
    assert(b[1] == toByteString('00')); // invalid

    //assert(slice(b, 1n, 2n) == toByteString('11')); // valid
  }
}
