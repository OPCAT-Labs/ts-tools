import {
  SmartContract,
  method,
  TxUtils,
  sha256,
  assert,
  StateLib,
  toByteString,
} from '../../src/index.js';
import { CounterState } from './counterState.js';

export class CounterStateLib extends StateLib<CounterState> {}

export class Counter extends SmartContract<CounterState> {
  @method()
  public increase() {
    this.state.count++;

    this.appendStateOutput(
      // new output of the contract
      TxUtils.buildOutput(this.ctx.spentScript, this.ctx.spentAmount),
      // new state hash of the contract
      // Counter.stateHash(this.state),
      CounterStateLib.stateHash(this.state),
    );

    const outputs = this.buildStateOutputs() + this.buildChangeOutput();

    assert(this.checkOutputs(outputs), 'Outputs mismatch with the transaction context');
  }
}
