import {
  SmartContract,
  method,
  TxUtils,
  assert,
  StateLib,
} from '../../src/index.js';
import { CounterState } from './counterState.js';

export class CounterStateLib extends StateLib<CounterState> {}

export class Counter extends SmartContract<CounterState> {
  @method()
  public increase() {
    this.state.count++;

    let data = Counter.stateSerialize(this.state);
    let outputs = TxUtils.buildDataOutput(this.ctx.spentScriptHash, this.ctx.value, data);

    outputs += this.buildChangeOutput();

    assert(this.checkOutputs(outputs), 'Outputs mismatch with the transaction context');
  }
}
