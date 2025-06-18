import { SmartContract, method, assert } from '@opcat-labs/scrypt-ts-opcat';

export class ExplicitReturn2 extends SmartContract {
  @method()
  public unlock(): void {
    if (true) {
      return;
    }
    assert(true);
  }
}
