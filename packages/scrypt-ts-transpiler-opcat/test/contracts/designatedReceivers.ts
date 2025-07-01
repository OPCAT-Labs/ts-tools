import {
  method,
  prop,
  SmartContract,
  assert,
  Addr,
  ByteString,
  TxUtils,
  sha256,
  hash256,
} from '@opcat-labs/scrypt-ts-opcat';

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
    const aliceOutput: ByteString = TxUtils.buildP2PKHOutput(1000n, this.alice);
    const bobOutput: ByteString = TxUtils.buildP2PKHOutput(1000n, this.bob);
    let outputs = aliceOutput + bobOutput;

    // require a change output
    outputs += this.buildChangeOutput();

    // ensure outputs are actually from the spending transaction as expected
    assert(this.ctx.hashOutputs == hash256(outputs), 'shaOutputs mismatch');
  }
}
