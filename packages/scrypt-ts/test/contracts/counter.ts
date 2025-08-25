import {
  SmartContract,
  method,
  assert,
  StateLib,
  OpcatState,
  Int32,
  sha256,
  TxUtils,
} from '@opcat-labs/scrypt-ts';

export interface CounterState extends OpcatState {
  count: Int32
}


export class CounterStateLib extends StateLib<CounterState> {}

export class Counter extends SmartContract<CounterState> {
  @method()
  public increase() {
    this.state.count++;

    // const nextOutput = TxUtils.buildDataOutput(this.ctx.spentScriptHash, this.ctx.value, CounterStateLib.stateHash(this.state) )
    // const nextOutput = TxUtils.buildDataOutput(this.ctx.spentScriptHash, this.ctx.value, sha256(CounterStateLib.serializeState(this.state)));
    // const nextOutput = TxUtils.buildDataOutput(this.ctx.spentScriptHash, this.ctx.value, Counter.stateHash(this.state) )
    const nextOutput = TxUtils.buildDataOutput(this.ctx.spentScriptHash, this.ctx.value, CounterStateLib.stateHash(this.state))
    const outputs = nextOutput + this.buildChangeOutput();

    assert(this.checkOutputs(outputs), 'Outputs mismatch with the transaction context');
  }
}
