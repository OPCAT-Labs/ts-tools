import { SmartContract, method, assert } from '@opcat-labs/scrypt-ts';

export class ExplicitReturn extends SmartContract {
  @method()
  public unlock(): void {
    assert(true);
    return;
  }
}
