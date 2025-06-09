import {
  Int32,
  SmartContract,
  method,
  TxUtils,
  sha256,
  assert,
  ByteString,
  Ripemd160,
} from '../../src/index.js';

// calling state methods (this.appendStateOutput, this.buildStateOutputs) in a non stateful contract is allowed

export class StateMethods extends SmartContract {
  @method()
  public unlock(script: ByteString, amount: ByteString, stateHash: Ripemd160) {
    this.appendStateOutput(TxUtils.buildOutput(script, amount), stateHash);
    const outputs = this.buildStateOutputs() + this.buildChangeOutput();
    assert(this.ctx.shaOutputs === sha256(outputs), `output hash mismatch`);
  }
}
