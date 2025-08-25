import {
  assert,
  ByteString,
  hash256,
  method,
  prop,
  PubKeyHash,
  SmartContract,
  TxUtils,
} from '@opcat-labs/scrypt-ts';

// todo: add sighash type
export class AnyoneCanSpend extends SmartContract {
  @prop()
  pubKeyHash: PubKeyHash;

  constructor(pubKeyHash: PubKeyHash) {
    super(pubKeyHash);
    this.pubKeyHash = pubKeyHash;
  }

  @method()
  public unlock() {
    let outputs: ByteString = TxUtils.buildP2PKHOutput(this.ctx.value, this.pubKeyHash);

    outputs += this.buildChangeOutput();
    assert(hash256(outputs) == this.ctx.hashOutputs, 'check hashOutputs failed');
  }
}
