import {
  method,
  prop,
  SmartContract,
  assert,
  PubKeyHash,
  Sig,
  PubKey,
  hash160,
  FixedArray,
} from '@opcat-labs/scrypt-ts-opcat';

export class CodeSeparator extends SmartContract {
  @prop()
  readonly addresses: FixedArray<PubKeyHash, 3>;

  constructor(addresses: FixedArray<PubKeyHash, 3>) {
    super(...arguments);
    this.addresses = addresses;
  }

  @method()
  public unlock(sigs: FixedArray<Sig, 3>, pubKeys: FixedArray<PubKey, 3>) {
    assert(hash160(pubKeys[0]) == this.addresses[0]);
    //this.insertCodeSeparator();
    assert(this.checkSig(sigs[0], pubKeys[0]));

    //this.insertCodeSeparator();
    assert(hash160(pubKeys[1]) == this.addresses[1]);
    assert(this.checkSig(sigs[1], pubKeys[1]));

    //this.insertCodeSeparator();
    assert(hash160(pubKeys[2]) == this.addresses[2]);
    assert(this.checkSig(sigs[2], pubKeys[2]));
  }
}
