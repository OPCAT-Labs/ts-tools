import {
  SmartContract,
  method,
  assert,
  Int32,
  TxUtils,
  ByteString,
  slice,
  StdUtils,
} from '../../src/index.js';
import { DelegateeState, DelegatorState, DelegatorStateLib } from './stateLibs.js';

export class StateDelegatee extends SmartContract<DelegateeState> {
  @method({ autoCheckInputState: false })
  public unlock(
    delegatorScriptHash: ByteString,
    delegatorState: DelegatorState,
    delegatorInputVal: Int32,
  ) {
    // manually check this.state
    this.checkInputState(this.ctx.inputIndex, StateDelegatee.serializeState(this.state));

    // check the delegator state
    this.checkInputState(delegatorInputVal, DelegatorStateLib.serializeState(delegatorState));


    assert(!delegatorState.delegated, 'Delegator has been already delegated');

    // update delegator state
    delegatorState.delegated = true;

    // check the first input is the delegator
    const delegatorSpentAmount = slice(this.ctx.spentAmounts, delegatorInputVal * 8n, (delegatorInputVal +  1n) * 8n);
    const delegatorSpentScriptHash = slice(this.ctx.spentScriptHashes, delegatorInputVal * 32n, (delegatorInputVal +  1n) * 32n);
    assert(delegatorSpentScriptHash === delegatorScriptHash);

    // build delegator output
    let outputs = TxUtils.buildDataOutput(delegatorScriptHash, StdUtils.fromLEUnsigned(delegatorSpentAmount), DelegatorStateLib.stateHash(delegatorState))

    // update delegatee state
    this.state.total++;

    // build delegatee output
    outputs = TxUtils.buildDataOutput(this.ctx.spentScriptHash, this.ctx.value, StateDelegatee.stateHash(this.state)) + this.buildChangeOutput();

    this.checkOutputs(outputs)
  }
}
