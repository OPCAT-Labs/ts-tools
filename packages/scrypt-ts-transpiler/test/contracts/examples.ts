import {
  abs,
  assert,
  intToByteString,
  len,
  max,
  method,
  min,
  SmartContract,
  toByteString,
  TxUtils,
  within,
  PubKeyHash,
  sha256,
} from '@opcat-labs/scrypt-ts';

export class Examples extends SmartContract {
  @method()
  public unlock() {
    assert(abs(1n) === 1n);
    assert(abs(0n) === 0n);
    assert(abs(-1n) === 1n);

    assert(min(1n, 2n) === 1n);

    assert(max(1n, 2n) === 2n);

    assert(within(0n, 0n, 2n));
    assert(within(1n, 0n, 2n));
    assert(!within(2n, 0n, 2n));

    assert(intToByteString(128n) === toByteString('8000'));
    assert(intToByteString(127n) === toByteString('7f'));
    assert(intToByteString(1n) === toByteString('01'));
    assert(intToByteString(0n) === toByteString(''));
    assert(intToByteString(-0n) === toByteString(''));
    assert(intToByteString(-1n) === toByteString('81'));
    assert(intToByteString(-127n) === toByteString('ff'));
    assert(intToByteString(-129n) === toByteString('8180'));

    assert(len(toByteString('0011', false)) === 2n);
    assert(len(toByteString('hello', true)) === 5n);

    const lockingScript = toByteString('01020304');
    assert(
      TxUtils.buildOutput(sha256(lockingScript) , 1n) ===
        toByteString('01000000000000000401020304'),
    );

    const pubKeyHash = PubKeyHash(toByteString('0011223344556677889900112233445566778899'));
    assert(
      TxUtils.buildP2PKHScript(pubKeyHash) ===
        toByteString('76a914001122334455667788990011223344556677889988ac'),
    );

    const str0 = toByteString('01ab23ef68');
    const str1 = toByteString('656c6c6f20776f726c64');

    // comparison
    assert(str0 != str1);
    assert(str0 !== str1);
    // false

    // concatenation
    assert(str0 + str1 === toByteString('01ab23ef68656c6c6f20776f726c64'));
    // '01ab23ef68656c6c6f20776f726c64'
  }
}
