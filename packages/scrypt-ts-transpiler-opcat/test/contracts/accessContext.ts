import { SmartContract, method, sha256, assert } from '@scrypt-inc/scrypt-ts-btc';

export class AccessContext extends SmartContract {
  @method()
  public unlock() {
    assert(this.ctx.inputIndexVal === 0n, 'inputIndexVal is not 0');
    const outputs = this.buildChangeOutput();
    assert(sha256(outputs) === this.ctx.shaOutputs, 'shaOutputs is not correct');
  }
}
