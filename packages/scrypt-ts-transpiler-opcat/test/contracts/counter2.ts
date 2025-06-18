import {
  Int32,
  SmartContract,
  method,
  TxUtils,
  sha256,
  assert,
  StructObject,
} from '@opcat-labs/scrypt-ts-opcat';

export interface Counter2State extends StructObject {
  count: Int32;
}

// state in private function

export class Counter2 extends SmartContract<Counter2State> {
  @method()
  public increase() {
    this.f1();
    assert(true);
  }

  @method()
  f1(): void {
    this.state.count++;

    this.appendStateOutput(
      // new output of the contract
      TxUtils.buildOutput(this.ctx.spentScript, this.ctx.spentAmount),
      // new state hash of the contract
      Counter2.stateHash(this.state),
    );

    const outputs = this.buildStateOutputs() + this.buildChangeOutput();

    assert(sha256(outputs) === this.ctx.shaOutputs, `output hash mismatch`);
  }
}
