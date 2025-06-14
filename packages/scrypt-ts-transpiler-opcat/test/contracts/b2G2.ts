import {
  assert,
  ByteString,
  method,
  prop,
  SmartContract,
  BacktraceInfo,
} from '@scrypt-inc/scrypt-ts-btc';

export class B2G2 extends SmartContract {
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
  public unlock(backtraceInfo: BacktraceInfo) {
    this.toOutputpint(backtraceInfo);
    this.toScript(backtraceInfo);
    assert(true);
  }

  @method()
  private toOutputpint(backtraceInfo: BacktraceInfo): void {
    assert(this.backtraceToOutpoint(backtraceInfo, this.genesisOutpoint));
  }

  @method()
  private toScript(backtraceInfo: BacktraceInfo): void {
    assert(this.backtraceToScript(backtraceInfo, this.minterScript));
  }
}
