import { SmartContract, method, sha256, assert } from '@opcat-labs/scrypt-ts-opcat';

export class AccessContext extends SmartContract {
  @method()
  public unlock() {
    assert(this.ctx.inputIndexVal === 0n, 'inputIndexVal is not 0');
    const outputs = this.buildChangeOutput();
    assert(sha256(outputs) === this.ctx.shaOutputs, 'shaOutputs is not correct');
  }
}
