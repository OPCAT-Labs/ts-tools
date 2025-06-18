import {
  assert,
  ByteString,
  len,
  method,
  PubKey,
  PubKeyHash,
  Ripemd160,
  Sha1,
  Sha256,
  Sig,
  SmartContract,
} from '@opcat-labs/scrypt-ts-opcat';

export class DomainSubtypes extends SmartContract {
  @method()
  public unlock(
    pubKey: PubKey,
    sig: Sig,
    ripemd160: Ripemd160,
    pkh: PubKeyHash,
    sha1: Sha1,
    sha256: Sha256,

    pubKeyBS: ByteString,
    ripemd160BS: ByteString,
    pkhBS: ByteString,
    sha1BS: ByteString,
    sha256BS: ByteString,
  ) {
    // Compare.
    assert(pubKey == pubKeyBS);
    assert(ripemd160 == ripemd160BS);
    assert(pkh == pkhBS);
    assert(sha1 == sha1BS);
    assert(sha256 == sha256BS);

    // Concat.
    assert(len(ripemd160 + sha256 + sha256BS) == 32n + 20n);
  }
}
