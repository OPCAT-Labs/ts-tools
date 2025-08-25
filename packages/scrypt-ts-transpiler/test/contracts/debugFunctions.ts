import {
  method,
  SmartContract,
  assert,
  Int32,
  TxUtils,
  sha256,
  StructObject,
} from '@opcat-labs/scrypt-ts';

/** contract with DebugFunctions call should be compiled successfully */

export interface DebugFunctionsTestState extends StructObject {
  counter: Int32;
}

export class DebugFunctionsTest extends SmartContract<DebugFunctionsTestState> {
  constructor() {
    super(...arguments);
  }

  @method()
  public increment() {
    this.state.counter++;
    const nextOutput = TxUtils.buildDataOutput(this.ctx.spentScriptHash, this.ctx.value, DebugFunctionsTest.stateHash(this.state))


    const outputs = nextOutput + this.buildChangeOutput();
    this.debug.diffOutputs(outputs);
    assert(this.checkOutputs(outputs), 'Outputs mismatch with the transaction context');
  }
}
