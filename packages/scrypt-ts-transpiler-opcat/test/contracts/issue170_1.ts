import { assert, equals, method, SmartContract } from '@scrypt-inc/scrypt-ts-btc';
import { Point, STInOtherFile } from './onlystruct';

export class Issue170_1 extends SmartContract {
  @method()
  public unlock(a: Point, st: STInOtherFile) {
    assert(
      equals(a, {
        x: 1n,
        y: 1n,
      }),
      'struct `a` is not equal',
    );
    assert(
      equals(st, {
        r: 12n,
        s: 11n,
      }),
      'struct `st` is not equal',
    );
  }
}
