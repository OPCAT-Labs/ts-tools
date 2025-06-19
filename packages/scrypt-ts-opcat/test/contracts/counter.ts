import {
  SmartContract,
  method,
  assert,
  StateLib,
  OpcatState,
  Int32,
} from '../../src/index.js';

export interface CounterState extends OpcatState {
  count: Int32;
}

export class Counter extends SmartContract<CounterState> {
  @method()
  public increase() {
    this.state.count++;

    let outputs = this.buildStateOutput(this.ctx.value);

    outputs += this.buildChangeOutput();

    assert(this.checkOutputs(outputs), 'Outputs mismatch with the transaction context');
  }
}
