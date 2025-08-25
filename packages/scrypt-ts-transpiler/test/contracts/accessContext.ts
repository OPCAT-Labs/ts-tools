import { SmartContract, method, sha256, assert, hash256 } from '@opcat-labs/scrypt-ts';

export class AccessContext extends SmartContract {
  @method()
  public unlock() {
    assert(this.ctx.inputIndex === 0n, 'inputIndexVal is not 0');
    const outputs = this.buildChangeOutput();
    assert(hash256(outputs) === this.ctx.hashOutputs, 'hashOutputs is not correct');
  }
}
