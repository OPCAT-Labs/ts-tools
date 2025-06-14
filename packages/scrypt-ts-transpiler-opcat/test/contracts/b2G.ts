import {
  assert,
  ByteString,
  method,
  prop,
  SmartContract,
  BacktraceInfo,
} from '@scrypt-inc/scrypt-ts-btc';

export class B2G extends SmartContract {
  @prop()
  genesisOutpoint: ByteString;

  @prop()
  minterScript: ByteString;

  constructor(genesisOutpoint: ByteString, minterScript: ByteString) {
    super(genesisOutpoint, minterScript);
    this.genesisOutpoint = genesisOutpoint;
    this.minterScript = minterScript;
  }

  @method()
  public toOutputpint(backtraceInfo: BacktraceInfo) {
    assert(this.backtraceToOutpoint(backtraceInfo, this.genesisOutpoint));
  }

  @method()
  public toScript(backtraceInfo: BacktraceInfo) {
    assert(this.backtraceToScript(backtraceInfo, this.minterScript));
  }
}
