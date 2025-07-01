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
    let outputs = TxUtils.buildDataOutput(this.ctx.spentScriptHash, this.ctx.value, BaseCounter2.stateHash(this.state));

    outputs += this.buildChangeOutput();

    assert(this.checkOutputs(outputs), 'checkOutputs failed');
  }


  @method()
  checkDummyProp(): void {
    assert(this.dummyProp == 1n, 'dummyProp should be 1');
  }
}
