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
  } from '@opcat-labs/scrypt-ts-opcat';
  
  export interface CounterState extends OpcatState {
    count: Int32
  }
  

  export class B2GCounter extends SmartContract<CounterState> {

    @prop()
    genesisOutpoint: ByteString;

    constructor(genesisOutpoint: ByteString) {
        super(genesisOutpoint);
        this.genesisOutpoint = genesisOutpoint;
    }

    
    @method()
    public increase(backtraceInfo: BacktraceInfo) {
      assert(this.backtraceToOutpoint(backtraceInfo, this.genesisOutpoint));
      this.state.count++;
      const nextOutput = TxUtils.buildDataOutput(this.ctx.spentScriptHash, this.ctx.value, B2GCounter.stateHash(this.state))
      const outputs = nextOutput + this.buildChangeOutput();
      assert(this.checkOutputs(outputs), 'Outputs mismatch with the transaction context');
    }
  }
  