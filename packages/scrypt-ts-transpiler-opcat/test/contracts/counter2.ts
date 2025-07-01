import {
  Int32,
  SmartContract,
  method,
  TxUtils,
  assert,
  StructObject,
} from '@opcat-labs/scrypt-ts-opcat';

export interface Counter2State extends StructObject {
  count: Int32;
}

// state in private function

export class Counter2 extends SmartContract<Counter2State> {
  @method()
  public increase() {
    this.f1();
    assert(true);
  }

  @method()
  f1(): void {
    this.state.count++;

    const nextOutput = TxUtils.buildDataOutput(this.ctx.spentScriptHash, this.ctx.value, Counter2.stateHash(this.state))


    const outputs = nextOutput + this.buildChangeOutput();

    assert(this.checkOutputs(outputs), 'Outputs mismatch with the transaction context');
  }
}
