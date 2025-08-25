import { assert, equals, method, SmartContract } from '@opcat-labs/scrypt-ts';
import { Point, Signature } from './onlystruct';

export class Issue170 extends SmartContract {
  @method()
  public unlock(a: Point, sig: Signature) {
    assert(
      equals(a, {
        x: 1n,
        y: 1n,
      }),
      'struct `a` is not equal',
    );
    assert(
      equals(sig, {
        r: 12n,
        s: 11n,
      }),
      'struct `sig` is not equal',
    );
  }
}
