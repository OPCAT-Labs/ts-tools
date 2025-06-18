import { Lib, SS } from './lib';
import {
  method,
  SmartContract,
  assert,
  ByteString,
  toByteString,
  equals,
} from '@opcat-labs/scrypt-ts-opcat';

export class TestLib extends SmartContract {
  @method()
  public unlock1(x: bigint) {
    const lib = new Lib(0n);
    const ss: SS = {
      a: 1n,
    };
    assert(
      equals(ss, {
        a: 1n,
      }),
    );
    assert(lib.add(1n, 2n) == x);
  }

  @method()
  public unlock2(dummyBytes: ByteString) {
    assert(dummyBytes == toByteString('00'), 'dummyBytes check failed');
  }
}
