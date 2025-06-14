import { Int32, SmartContract, method, TxUtils, sha256, assert } from '@scrypt-inc/scrypt-ts-btc';

// test `type`
export type Counter3State = {
  count: Int32;
};

export class Counter3 extends SmartContract<Counter3State> {
  @method()
  public increase() {
    this.state.count++;

    this.appendStateOutput(
      // new output of the contract
      TxUtils.buildOutput(this.ctx.spentScript, this.ctx.spentAmount),
      // new state hash of the contract
      Counter3.stateHash(this.state),
    );

    const outputs = this.buildStateOutputs() + this.buildChangeOutput();

    // this.debug.diffOutputs(outputs);

    assert(sha256(outputs) === this.ctx.shaOutputs, `output hash mismatch`);
  }
}
