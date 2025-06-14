import { assert, method, SmartContract } from '@scrypt-inc/scrypt-ts-btc';
import { Demo } from '../demo';

export class Issue292 extends SmartContract {
  @method()
  public unlock() {
    const demo = new Demo(1n, 2n);
    demo.add(3n);
    assert(true);
  }
}
