import { SmartContract, method, assert } from '@scrypt-inc/scrypt-ts-btc';

export class ExplicitReturn2 extends SmartContract {
  @method()
  public unlock(): void {
    if (true) {
      return;
    }
    assert(true);
  }
}
