import {
  method,
  SmartContract,
  assert,
  ByteString,
  toByteString,
  intToByteString,
  max,
  min,
  within,
  abs,
} from '@opcat-labs/scrypt-ts-opcat';

export class Builtins extends SmartContract {
  @method()
  public unlockInt2ByteString(data: ByteString, n: bigint) {
    assert(intToByteString(n) == data, 'bad `int2ByteString` function');
  }

  @method()
  public testMath() {
    assert(max(1n, 2n) == 2n);
    assert(max(0n, 2n) == 2n);
    assert(max(-1n, 2n) == 2n);
    assert(max(-1n, -1n) == -1n);
    assert(max(0n, 0n) == 0n);

    assert(min(1n, 2n) == 1n);
    assert(min(0n, 2n) == 0n);
    assert(min(-1n, 2n) == -1n);
    assert(min(-1n, -1n) == -1n);
    assert(min(0n, 0n) == 0n);

    assert(within(0n, -1n, 1n));
    assert(within(-1n, -1n, 1n));
    assert(within(1n, -1n, 1n) == false);

    assert(abs(0n) == 0n);
    assert(abs(1n) == 1n);
    assert(abs(-1n) == 1n);

    const a: ByteString = toByteString('00');
    assert(a == toByteString('00'));
  }
}
