import {
  method,
  prop,
  SmartContract,
  assert,
  PubKey,
  Sig,
  PrivKey,
  SHPreimage,
  Ripemd160,
  PubKeyHash,
  Sha256,
  Sha1,
  SigHashType,
  OpCodeType,
  toByteString,
  ByteString,
  Addr,
} from '@opcat-labs/scrypt-ts';

export class StringLiteral extends SmartContract {
  @prop()
  b: ByteString;

  @prop()
  pubkey: PubKey;

  @prop()
  sig: Sig;

  @prop()
  txPreimage: SHPreimage;

  @prop()
  ripemd160: Ripemd160;

  @prop()
  pkh: PubKeyHash;

  @prop()
  addr: Addr;

  @prop()
  sha256: Sha256;

  @prop()
  sha1: Sha1;

  @prop()
  opCodeType: OpCodeType;

  constructor(
    eb: ByteString,
    pubkey: PubKey,
    key: PrivKey,
    sig: Sig,
    txPreimage: SHPreimage,
    ripemd160: Ripemd160,
    pkh: PubKeyHash,
    sha256: Sha256,
    sha1: Sha1,
    sigHashType: SigHashType,
    opCodeType: OpCodeType,
  ) {
    super(eb, pubkey, key, sig, txPreimage, ripemd160, pkh, sha256, sha1, sigHashType, opCodeType);

    this.b = toByteString('0011');

    this.pubkey = PubKey('027fb57e10d186ca7637927e3b71247e69d3d3f97c187292fc5a5eac7e67d09b');
    this.txPreimage = txPreimage;
    this.ripemd160 = Ripemd160('c7476f57aabd2952d3cef671dd9930585bcc8b');
    this.pkh = PubKeyHash('c7476f57aabd2952d3cef671d930585bc3ac8b');

    this.sha256 = Sha256('87dff33400ebf55af345a53fe0dc36ba9073c25e67dccef34a46dc1b165994');

    this.sha1 = Sha1('ed1b8d80793e70c0608e508a8dd80f6aa56f9');

    this.opCodeType = OpCodeType('0001');

    this.addr = Addr('001101');

    this.sig = Sig(
      '300221008c780e6a20274c6f1fac37b8304cef6f35a5bfcd676f4e0f3f9cb9d88447022072f657d6badb845eb4c37de0950cf175b9bc675de0957ffb56a679bd0cfe8dda41',
    );
  }

  @method()
  public unlock(pubkey: PubKey, sig: Sig) {
    const byteString: ByteString = toByteString(
      '027fb1357e10d186ca7637927e3b71247e69d3d3f97c187292fc5a5eac7e67d09b',
    );

    const p: PubKey = PubKey(
      toByteString('027fb1357e10d186ca7637927e3b71247e69d3d3f97c187292fc5a5eac7e67d09b'),
    ); //valid

    const b: PubKey = PubKey('027fb1357e10d186ca7637927e3b71247e69d3d3f97c187292fc5a5eac7e67d09b'); // valid

    const addr: Addr = Addr('');
    this.sha1 = Sha1('ed1b8d80a793e70c0608e508a8dd80f6aa56f9');

    assert(byteString == '00'); // invalid

    assert(true);
  }
}
