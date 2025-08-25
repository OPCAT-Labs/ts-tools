import { assert, ByteString, method, prop, SmartContract, type BacktraceInfo } from '@opcat-labs/scrypt-ts';

export class InvalidB2G extends SmartContract {
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
  public unlock1(backtraceInfo: BacktraceInfo) {
    this.toOutputpint(backtraceInfo);
  }

  @method()
  public unlock2(backtraceInfo: BacktraceInfo) {
    this.toScript(backtraceInfo);
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
