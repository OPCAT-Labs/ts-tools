import { assert, method, SmartContract, toByteString } from '@opcat-labs/scrypt-ts';

export class OperatorRequiresBoolean extends SmartContract {
  @method()
  public unlock() {
    const a = toByteString('00112233');
    const t = true;
    const f = false;
    const b = 0x00112233n > 0n;
    // valid
    assert(t && f);
    assert(t && true);
    assert(t || f);
    assert(f || false);
    assert(!t || b);
    assert(!t);
    assert(!false);
    // invalid
    assert(a && t);
    assert((a && a) == toByteString('00'));
    assert((a || a) == toByteString('11'));
    assert(!a);
  }
}
