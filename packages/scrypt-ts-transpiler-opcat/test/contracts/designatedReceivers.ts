import {
  method,
  prop,
  SmartContract,
  assert,
  Addr,
  ByteString,
  TxUtils,
  sha256,
} from '@scrypt-inc/scrypt-ts-btc';

export class DesignatedReceivers extends SmartContract {
  @prop()
  readonly alice: Addr;

  @prop()
  readonly bob: Addr;

  constructor(alice: Addr, bob: Addr) {
    super(...arguments);
    this.alice = alice;
    this.bob = bob;
  }

  @method()
  public payout() {
    const aliceOutput: ByteString = TxUtils.buildP2PKHOutput(this.alice, TxUtils.toSatoshis(1000n));
    const bobOutput: ByteString = TxUtils.buildP2PKHOutput(this.bob, TxUtils.toSatoshis(1000n));
    let outputs = aliceOutput + bobOutput;

    // require a change output
    outputs += this.buildChangeOutput();

    // ensure outputs are actually from the spending transaction as expected
    assert(this.ctx.shaOutputs == sha256(outputs), 'shaOutputs mismatch');
  }
}
