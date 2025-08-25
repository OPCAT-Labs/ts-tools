import {
  method,
  prop,
  SmartContract,
  assert,
  hash256,
  TxUtils,
  sha256,
  Int32,
  StructObject,
} from '@opcat-labs/scrypt-ts';

export interface BaseCounterState extends StructObject {
  counter: Int32;
}
export class BaseCounter extends SmartContract<BaseCounterState> {
  @prop()
  readonly dummyProp: bigint;

  constructor(dummyProp: bigint) {
    super(...arguments);
    this.dummyProp = dummyProp;
  }

  @method()
  public incOnchain() {
    this.incCounter();

    let outputs = TxUtils.buildDataOutput(this.ctx.spentScriptHash, this.ctx.value, BaseCounter.stateHash(this.state));

    outputs += this.buildChangeOutput()
    assert(this.checkOutputs(outputs),
      'checkOutputs failed',
    );
  }

  @method()
  incCounter(): boolean {
    this.state.counter++;
    return true;
  }
}
