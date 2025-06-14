import {
  method,
  prop,
  SmartContract,
  assert,
  Sha256,
  Sha1,
  sha1,
  sha256,
  hash256,
  hash160,
  Ripemd160,
  ripemd160,
  ByteString,
} from '@scrypt-inc/scrypt-ts-btc';

export class HashPuzzle extends SmartContract {
  @prop()
  sha256: Sha256;

  @prop()
  hash256: Sha256;

  @prop()
  hash160: Ripemd160;

  @prop()
  ripemd160: Ripemd160;

  @prop()
  sha1: Sha1;

  constructor(
    sha256: Sha256,
    hash256: Sha256,
    hash160: Ripemd160,
    ripemd160: Ripemd160,
    sha1: Sha1,
  ) {
    super(sha256, hash256, hash160, ripemd160, sha1);
    this.sha256 = sha256;
    this.hash256 = hash256;
    this.hash160 = hash160;
    this.ripemd160 = ripemd160;
    this.sha1 = sha1;
  }

  @method()
  public unlock(data: ByteString) {
    assert(this.sha256 == sha256(data));
    assert(this.hash256 == hash256(data));
    assert(this.hash160 == hash160(data));
    assert(this.ripemd160 == ripemd160(data));
    assert(this.sha1 == sha1(data));
  }
}
