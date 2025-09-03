import {
  SmartContract,
  method,
  assert,
  Int32,
  sha256,
  TxUtils,
  ByteString,
  slice,
  byteStringToInt,
} from '@opcat-labs/scrypt-ts-opcat';
import { DelegateeState, DelegatorState, DelegatorStateLib } from './stateLibs.js';

const TX_INPUT_COUNT_MAX =  6;
export class StateDelegatee extends SmartContract<DelegateeState> {
  @method({ autoCheckInputState: false })
  public unlock(
    delegatorScript: ByteString,
    delegatorState: DelegatorState,
    delegatorState__dot__mapHashedMapCtx: HashedMapCtx,
    map: HashedMap<ByteString, DelegateeState, 1>,
    mapHashedMapCtx: HashedMapCtx,
    delegatorInputVal: Int32,
  ) {
    // manually check this.state
    for (let i = 0; i < TX_INPUT_COUNT_MAX; i++) {
      if (BigInt(i) === this.ctx.inputIndex) {
        this.checkInputState(BigInt(i), StateDelegatee.serializeState(this.state));
      }
    }

    // check the delegator state
    this.checkInputState(delegatorInputVal, DelegatorStateLib.serializeState(delegatorState));


    assert(!delegatorState.delegated, 'Delegator has been already delegated');

    // update delegator state
    delegatorState.delegated = true;

    // check the first input is the delegator
    assert(slice(this.ctx.spentScriptHashes, 0n, 32n) === sha256(delegatorScript));

    // build delegator output
    const spentAmount = slice(this.ctx.spentAmounts, delegatorInputVal, (delegatorInputVal + 1n)*32n);
    let outputs = TxUtils.buildDataOutput(sha256(delegatorScript), byteStringToInt(spentAmount), DelegatorStateLib.stateHash(delegatorState))


    // check current state
    // DelegateeStateLib.checkState(this.state);

    // update delegatee state
    this.state.total++;

    // build delegatee output
    outputs += 
      TxUtils.buildDataOutput(this.ctx.spentScriptHash, this.ctx.value, StateDelegatee.stateHash(this.state))

    outputs += this.buildChangeOutput();

    assert(this.checkOutputs(outputs), "checkoutput failed");
  }
}
