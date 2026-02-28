import {
  SmartContract,
  method,
  assert,
  OpcatState,
  Int32,
  TxUtils,
  BacktraceInfo,
  prop,
  ByteString,
  Sig,
  PubKey,
} from '@opcat-labs/scrypt-ts-opcat';

export interface B2GAnyonecanpayState extends OpcatState {
  count: Int32;
}

const SigHashType = {
  ANYONECANPAY_ALL: 0x81,
} as const;

export class B2GAnyonecanpay extends SmartContract<B2GAnyonecanpayState> {
  @prop()
  genesisOutpoint: ByteString;

  @prop()
  ownerPubKey: PubKey;

  constructor(genesisOutpoint: ByteString, ownerPubKey: PubKey) {
    super(genesisOutpoint, ownerPubKey);
    this.genesisOutpoint = genesisOutpoint;
    this.ownerPubKey = ownerPubKey;
  }

  @method({ sigHashType: SigHashType.ANYONECANPAY_ALL })
  public increase(backtraceInfo: BacktraceInfo, sig: Sig) {
    // Verify backtrace
    assert(
      this.backtraceToOutpoint(backtraceInfo, this.genesisOutpoint),
      'backtrace failed'
    );

    // Verify signature
    assert(this.checkSig(sig, this.ownerPubKey), 'signature check failed');

    // Increase counter (uses this.state)
    this.state.count++;

    // Build outputs (uses buildChangeOutput())
    const nextOutput = TxUtils.buildDataOutput(
      this.ctx.spentScriptHash,
      this.ctx.value,
      B2GAnyonecanpay.stateHash(this.state)
    );
    const outputs = nextOutput + this.buildChangeOutput();
    assert(this.checkOutputs(outputs), 'Outputs mismatch');
  }
}
