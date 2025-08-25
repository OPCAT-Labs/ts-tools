import { method, SmartContract, assert, toByteString, ByteString } from '@opcat-labs/scrypt-ts';

export class Operator extends SmartContract {
  @method()
  public unlock(z: bigint) {
    let a: bigint = 3n;
    const b: bigint = 4n;

    let x: ByteString = toByteString('aabb11ff');
    const y: ByteString = toByteString('cc22');

    // Binary
    a++;
    a--;
    ++a;
    --a;

    a + b;
    a - b;
    // a / b;
    // a * b;
    // a % b;

    a += b;
    a -= b;
    // a /= b;
    // a *= b;
    // a %= b;

    x += y;
    assert(x == toByteString('aabb11ffcc22'));

    a < b;
    a <= b;
    a > b;
    a >= b;

    if (a != b) {
      assert(a !== b);
    }

    let t: boolean = false ? a > 0 : b < 1;

    t && t;
    t || t;

    assert(z === 1n);

    // Unary
    a = -a;
    t = !t;

    assert(z == 1n);
  }
}
