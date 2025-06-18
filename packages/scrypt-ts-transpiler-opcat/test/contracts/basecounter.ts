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
} from '@opcat-labs/scrypt-ts-opcat';

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

    this.appendStateOutput(
      TxUtils.buildOutput(this.ctx.spentScript, this.ctx.spentAmount),
      BaseCounter.stateHash(this.state),
    );

    assert(
      this.ctx.shaOutputs == sha256(this.buildStateOutputs() + this.buildChangeOutput()),
      'shaOutputs check failed',
    );
  }

  @method()
  incCounter(): boolean {
    this.state.counter++;
    return true;
  }
}
