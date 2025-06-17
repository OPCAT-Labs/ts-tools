import {
  SmartContract,
  method,
  assert,
  Int32,
  sha256,
  TxUtils,
  ByteString,
  TX_INPUT_COUNT_MAX,
} from '@opcat-labs/scrypt-ts-opcat';
import { DelegateeState, DelegatorState, DelegatorStateLib } from './stateLibs.js';

export class StateDelegatee extends SmartContract<DelegateeState> {
  @method({ autoCheckInputState: false })
  public unlock(
    delegatorScript: ByteString,
    delegatorState: DelegatorState,
    delegatorInputVal: Int32,
  ) {
    // manually check this.state
    for (let i = 0; i < TX_INPUT_COUNT_MAX; i++) {
      if (BigInt(i) === this.ctx.inputIndexVal) {
        this.checkInputStateHash(BigInt(i), StateDelegatee.stateHash(this.state));
        assert(this.ctx.inputStateProof === this.ctx.inputStateProofs[i]);
      }
    }

    // check the delegator state
    this.checkInputStateHash(delegatorInputVal, DelegatorStateLib.stateHash(delegatorState));

    assert(
      // the initial output index after deployment
      this.ctx.inputStateProofs[Number(this.ctx.inputIndexVal)].outputIndexVal === 1n ||
        // the output index after the first call
        this.ctx.inputStateProof.outputIndexVal === 2n,
      'Invalid output index',
    );

    assert(!delegatorState.delegated, 'Delegator has been already delegated');

    // update delegator state
    delegatorState.delegated = true;

    // check the first input is the delegator
    assert(this.ctx.spentScripts[0] === delegatorScript);

    // build delegator output
    this.appendStateOutput(
      TxUtils.buildOutput(delegatorScript, this.ctx.spentAmounts[Number(delegatorInputVal)]),
      DelegatorStateLib.stateHash(delegatorState),
    );

    // check current state
    // DelegateeStateLib.checkState(this.state);

    // update delegatee state
    this.state.total++;

    // build delegatee output
    this.appendStateOutput(
      TxUtils.buildOutput(this.ctx.spentScript, this.ctx.spentAmount),
      StateDelegatee.stateHash(this.state),
    );

    const outputs = this.buildStateOutputs() + this.buildChangeOutput();

    assert(sha256(outputs) === this.ctx.shaOutputs);
  }
}
