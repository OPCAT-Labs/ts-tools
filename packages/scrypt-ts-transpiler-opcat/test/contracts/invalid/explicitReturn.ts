import { SmartContract, method, assert } from '@scrypt-inc/scrypt-ts-btc';

export class ExplicitReturn extends SmartContract {
  @method()
  public unlock(): void {
    assert(true);
    return;
  }
}
