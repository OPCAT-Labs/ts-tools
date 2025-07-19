import {
  SmartContract,
  prop,
  ByteString,
  method,
  assert,
  Sig,
  PubKey,
  hash160,
} from '@opcat-labs/scrypt-ts-opcat'

export class P2PKH extends SmartContract {
  @prop()
  pkh: ByteString

  constructor(pkh: ByteString) {
    super(...arguments)
    this.pkh = pkh
  }

  @method()
  public unlock(sig: Sig, pubKey: PubKey) {
    assert(this.checkSig(sig, pubKey))
    assert(hash160(pubKey) == this.pkh)
  }
}
