import { assert, ByteString, hash256, method, SmartContract } from '@opcat-labs/scrypt-ts-opcat';

export class ChangeAmountExample extends SmartContract {
  constructor() {
    super(...arguments);
  }

  @method()
  public unlock(destOutput: ByteString) {
    assert(hash256(destOutput + this.buildChangeOutput()) == this.ctx.hashOutputs);
  }
}
