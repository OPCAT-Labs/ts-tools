import {
  SmartContract,
  method,
  assert,
  StateLib,
  OpcatState,
  Int32,
  sha256,
  TxUtils,
  FixedArray,
} from '@opcat-labs/scrypt-ts';

export interface MultiDimArrayState extends OpcatState {
  board: FixedArray<FixedArray<Int32, 3>, 3>;
}


export class MultiDimArrayStateLib extends StateLib<MultiDimArrayState> {}

export class MultiDimArray extends SmartContract<MultiDimArrayState> {
  @method()
  public move(x: Int32, y: Int32, val: Int32) {
    this.state.board[Number(x)][Number(y)] = val;

    const nextOutput = TxUtils.buildDataOutput(this.ctx.spentScriptHash, this.ctx.value, MultiDimArrayStateLib.stateHash(this.state))
    const outputs = nextOutput + this.buildChangeOutput();

    assert(this.checkOutputs(outputs), 'Outputs mismatch with the transaction context');
  }
}
