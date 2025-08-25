import { SmartContract, method, assert } from '@opcat-labs/scrypt-ts';

export class ExplicitReturn2 extends SmartContract {
  @method()
  public unlock(): void {
    if (true) {
      return;
    }
    assert(true);
  }
}
