import {
  method,
  SmartContract,
  assert,
  Int32,
  TxUtils,
  sha256,
  StructObject,
} from '@scrypt-inc/scrypt-ts-btc';

/** contract with DebugFunctions call should be compiled successfully */

export interface DebugFunctionsTestState extends StructObject {
  counter: Int32;
}

export class DebugFunctionsTest extends SmartContract<DebugFunctionsTestState> {
  constructor() {
    super(...arguments);
  }

  // @method(SigHash.SINGLE)
  @method()
  public increment() {
    this.state.counter++;
    this.appendStateOutput(
      TxUtils.buildOutput(this.ctx.spentScript, this.ctx.spentAmount),
      DebugFunctionsTest.stateHash(this.state),
    );
    const outputs = this.buildStateOutputs();
    this.debug.diffOutputs(outputs);
    assert(this.ctx.shaOutputs == sha256(outputs));
  }

  @method()
  public incrementThrow() {
    this.state.counter++;
    this.debug.diffOutputs(this.buildStateOutputs());
    const outputs = this.buildStateOutputs();
    assert(this.ctx.shaOutputs == sha256(outputs));
  }
}
