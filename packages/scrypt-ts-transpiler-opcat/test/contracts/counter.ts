import {
  SmartContract,
  method,
  TxUtils,
  sha256,
  assert,
  StateLib,
} from '@opcat-labs/scrypt-ts-opcat';
import { CounterState } from './counterState.js';

export class CounterStateLib extends StateLib<CounterState> {}

export class Counter extends SmartContract<CounterState> {
  @method()
  public increase() {
    this.state.count++;

    TxUtils.buildDataOutput(this.ctx.spentScriptHash, this.ctx.value, CounterStateLib.stateHash(this.state) )
    TxUtils.buildDataOutput(this.ctx.spentScriptHash, this.ctx.value, sha256(CounterStateLib.serializeState(this.state)));
    TxUtils.buildDataOutput(this.ctx.spentScriptHash, this.ctx.value, Counter.stateHash(this.state) )
    TxUtils.buildDataOutput(this.ctx.spentScriptHash, this.ctx.value, sha256(CounterStateLib.serializeState(this.state)) )
    const nextOutput = TxUtils.buildDataOutput(this.ctx.spentScriptHash, this.ctx.value, CounterStateLib.stateHash(this.state))

    Counter.serializeState({
      count: 3n,
      b: true,
    })
    Counter.stateHash({
      count: 3n,
      b: true,
    })
    CounterStateLib.serializeState({
      count: 3n,
      b: true,
    })
    CounterStateLib.stateHash({
      count: 3n,
      b: true,
    })
    const outputs = nextOutput + this.buildChangeOutput();

    assert(this.checkOutputs(outputs), 'Outputs mismatch with the transaction context');
  }
}
