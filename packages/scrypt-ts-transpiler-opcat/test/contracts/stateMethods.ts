import {
  Int32,
  SmartContract,
  method,
  TxUtils,
  assert,
  ByteString,
} from '@opcat-labs/scrypt-ts-opcat';

// calling state methods (this.appendStateOutput, this.buildStateOutputs) in a non stateful contract is allowed

type StateMethodsState = {
  data: ByteString;
}
export class StateMethods extends SmartContract<StateMethodsState> {
  @method()
  public unlock(scriptHash: ByteString, amount: Int32, stateHash: ByteString) {
    let outputs = TxUtils.buildDataOutput(scriptHash, amount, stateHash);
    outputs += this.buildChangeOutput();
    assert(this.checkOutputs(outputs), `output hash mismatch`);
  }
}
