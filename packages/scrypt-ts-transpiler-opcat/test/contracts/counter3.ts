import { Int32, SmartContract, method, TxUtils, sha256, assert } from '@opcat-labs/scrypt-ts-opcat';

// test `type`
export type Counter3State = {
  count: Int32;
};

export class Counter3 extends SmartContract<Counter3State> {
  @method()
  public increase() {
    this.state.count++;

   const nextOutput = TxUtils.buildDataOutput(this.ctx.spentScriptHash, this.ctx.value, Counter3.stateHash(this.state))


    const outputs = nextOutput + this.buildChangeOutput();

    assert(this.checkOutputs(outputs), 'Outputs mismatch with the transaction context');
  }
}
