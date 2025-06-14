import {
  Int32,
  SmartContract,
  method,
  TxUtils,
  sha256,
  assert,
  ByteString,
  StructObject,
} from '@scrypt-inc/scrypt-ts-btc';

export interface InvalidStateState extends StructObject {
  count: Int32;
}

// calling another public method which has access to state is not allowed

export class InvalidState extends SmartContract<InvalidStateState> {
  @method()
  public increase(script: ByteString, amount: ByteString) {
    this.f1(script, amount);
    assert(true);
  }

  @method()
  public f1(script: ByteString, amount: ByteString) {
    this.state.count++;

    this.appendStateOutput(TxUtils.buildOutput(script, amount), InvalidState.stateHash(this.state));

    const outputs = this.buildStateOutputs();
    assert(true);

    // assert(sha256(outputs) === this.ctx.shaOutputs, `output hash mismatch`);
  }
}
