import { SmartContract, method, sha256, assert } from '../../src/index.js';

export class AccessContext extends SmartContract {
  @method()
  public unlock() {
    this.ctx.prevout.outputIndex;
    this.ctx.prevouts[0];
    assert(this.ctx.inputIndexVal === 0n, 'inputIndexVal is not 0');
    const outputs = this.buildChangeOutput();
    assert(sha256(outputs) === this.ctx.shaOutputs, 'shaOutputs is not correct');
  }
}
