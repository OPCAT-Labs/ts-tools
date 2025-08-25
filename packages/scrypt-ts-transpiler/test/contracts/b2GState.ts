import {
  assert,
  ByteString,
  Int32,
  method,
  prop,
  SmartContract,
  BacktraceInfo,
} from '@opcat-labs/scrypt-ts';

export type State = {
  counter: Int32;
};

// test b2g with state

export class B2GState extends SmartContract<State> {
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
  public toOutpoint(backtraceInfo: BacktraceInfo) {
    // not access state
    assert(this.backtraceToOutpoint(backtraceInfo, this.genesisOutpoint));
  }

  @method()
  public toScript(backtraceInfo: BacktraceInfo) {
    // not access state
    assert(this.backtraceToScript(backtraceInfo, this.minterScript));
  }

  @method()
  public toOutpoint2(backtraceInfo: BacktraceInfo) {
    // access state
    assert(this.state.counter > 0);
    assert(this.backtraceToOutpoint(backtraceInfo, this.genesisOutpoint));
  }

  @method()
  public toScript2(backtraceInfo: BacktraceInfo) {
    // access state
    assert(this.state.counter > 0);
    assert(this.backtraceToScript(backtraceInfo, this.minterScript));
  }
}
