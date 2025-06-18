import { method, prop, SmartContract, assert, hash256, SigHash } from '@opcat-labs/scrypt-ts-opcat';

export class SigHashChangeSINGLE extends SmartContract {
  @prop(true)
  counter: bigint;

  constructor(counter: bigint) {
    super(...arguments);
    this.counter = counter;
  }

  @method(SigHash.ANYONECANPAY_SINGLE)
  public incOnchain() {
    this.incCounter();

    let out = this.buildStateOutput(this.ctx.utxo.value);
    out += this.buildChangeOutput();
    assert(this.ctx.hashOutputs == hash256(out), 'hashOutputs check failed');
  }

  @method()
  incCounter(): boolean {
    this.counter++;
    return true;
  }

  incLocally() {
    this.incCounter();
  }
}
