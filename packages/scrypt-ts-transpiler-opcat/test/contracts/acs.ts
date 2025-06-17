import {
  assert,
  ByteString,
  method,
  prop,
  PubKeyHash,
  sha256,
  SmartContract,
  TxUtils,
} from '@opcat-labs/scrypt-ts-opcat';

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
    let outputs: ByteString = TxUtils.buildP2PKHOutput(this.pubKeyHash, this.changeInfo.script);

    outputs += this.buildChangeOutput();
    assert(sha256(outputs) == this.ctx.shaOutputs, 'check shaOutputs failed');
  }
}
