import {
  SmartContract,
  method,
  TxUtils,
  hash256,
  assert,
  ByteString,
  Ripemd160,
} from '@opcat-labs/scrypt-ts';

// calling state methods (this.appendStateOutput, this.buildStateOutputs) in a non stateful contract is allowed

export class StateMethods extends SmartContract {
  @method()
  public unlock(scriptHash: ByteString, amount: bigint, dataHash: Ripemd160) {
    let stateOutput = TxUtils.buildDataOutput(scriptHash, amount, dataHash);
    const outputs = stateOutput + this.buildChangeOutput();
    assert(this.ctx.hashOutputs === hash256(outputs), `output hash mismatch`);
  }
}
