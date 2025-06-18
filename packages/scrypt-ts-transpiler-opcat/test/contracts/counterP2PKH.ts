import {
  method,
  prop,
  SmartContract,
  assert,
  hash256,
  PubKeyHash,
  hash160,
  PubKey,
  Sig,
  Int32,
  StructObject,
} from '@opcat-labs/scrypt-ts-opcat';

export interface CounterP2PKHState extends StructObject {
  counter: Int32;
}

export class CounterP2PKH extends SmartContract<CounterP2PKHState> {
  @prop()
  readonly pubKeyHash: PubKeyHash;

  constructor(pubKeyHash: PubKeyHash) {
    super(...arguments);
    this.pubKeyHash = pubKeyHash;
  }

  @method()
  public incOnchain(sig: Sig, pubkey: PubKey) {
    assert(hash160(pubkey) == this.pubKeyHash, 'pubKeyHash check failed');
    assert(this.checkSig(sig, pubkey));
    this.incCounter();
    assert(this.ctx.shaOutputs == hash256(this.buildStateOutputs()), 'shaOutputs check failed');
  }

  @method()
  incCounter(): boolean {
    this.state.counter++;
    return true;
  }
}
