import { method, SmartContract, assert, sha256 } from '@opcat-labs/scrypt-ts';

export class TestCtx extends SmartContract {
  @method()
  public unlock() {
    assert(this.ctx.inputIndex === 0n, 'inputIndexVal is not 0');
    const outputs = this.buildChangeOutput();
    assert(sha256(outputs) === this.ctx.hashOutputs, 'hashOutputs is not correct');
  }
}
