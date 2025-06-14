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
} from '@scrypt-inc/scrypt-ts-btc';

export class BaseCounter2<T extends StructObject> extends SmartContract<T> {
  @prop()
  readonly dummyProp: bigint;

  constructor(dummyProp: bigint) {
    super(...arguments);
    this.dummyProp = dummyProp;
  }

  @method()
  public donothing() {
    this.checkDummyProp();

    this.appendStateOutput(
      TxUtils.buildOutput(this.ctx.spentScript, this.ctx.spentAmount),
      BaseCounter2.stateHash(this.state),
    );

    assert(
      this.ctx.shaOutputs == sha256(this.buildStateOutputs() + this.buildChangeOutput()),
      'shaOutputs check failed',
    );
  }

  @method()
  checkDummyProp(): void {
    assert(this.dummyProp == 1n, 'dummyProp should be 1');
  }
}
