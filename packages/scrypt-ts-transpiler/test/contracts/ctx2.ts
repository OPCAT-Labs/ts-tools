import { method, prop, SmartContract, assert, ByteString } from '@opcat-labs/scrypt-ts';

export class CTX2 extends SmartContract {
  @prop()
  counter: bigint;

  constructor(counter: bigint) {
    super(...arguments);
    this.counter = counter;
  }

  @method()
  public incOnchain() {
    this.waaaccc();

    assert(true);
  }

  @method()
  txid(): ByteString {
    const outputs = this.buildChangeOutput();
    const aa = this.ctx.prevouts;
    return this.ctx.prevout.txHash;
  }

  @method()
  waaa(): ByteString {
    return this.txid();
  }

  @method()
  waaaccc(): ByteString {
    return this.waaa();
  }

  @method()
  incCounter(): boolean {
    this.counter++;
    return true;
  }
}
