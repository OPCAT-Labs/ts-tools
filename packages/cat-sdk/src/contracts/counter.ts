import {
  sha256,
  SmartContract,
  method,
  assert,
  TxUtils,
} from '@opcat-labs/scrypt-ts-opcat'

export type CounterState = {
  count: bigint
}

export class Counter extends SmartContract<CounterState> {
  @method()
  public increase(
  ) {
    // increase
    this.state.count++

    const outputs =
      TxUtils.buildDataOutput(
        this.ctx.spentScriptHash,
        this.ctx.value,
        sha256(Counter.serializeState(this.state))
      ) + this.buildChangeOutput()

    assert(this.checkOutputs(outputs))
  }
}
