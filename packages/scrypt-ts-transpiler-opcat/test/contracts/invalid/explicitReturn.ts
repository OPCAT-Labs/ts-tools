import { SmartContract, method, assert } from '@opcat-labs/scrypt-ts-opcat';

export class ExplicitReturn extends SmartContract {
  @method()
  public unlock(): void {
    assert(true);
    return;
  }
}
