import { assert, method, SmartContract } from '@opcat-labs/scrypt-ts';

/// a transpilable contract for ctx, will be transpiled successfully
export class CTX3 extends SmartContract {
  @method()
  public unlock() {
    this.ctx.nVersion;
    this.ctx.nLockTime;
    this.ctx.hashPrevouts;
    this.ctx.hashSpentAmounts;
    this.ctx.hashSpentScriptHashes;
    this.ctx.hashSequences;
    this.ctx.hashSpentDataHashes;
    this.ctx.inputIndex;
    this.ctx.spentScriptHash;
    this.ctx.spentDataHash;
    this.ctx.value;
    this.ctx.nSequence;
    this.ctx.sigHashType;

    this.ctx.prevout;
    this.ctx.prevouts;
    this.ctx.hashSpentScriptHashes;
    this.ctx.spentAmounts;

    this.ctx.prevout.outputIndex;
    this.ctx.prevout.txHash;
    this.ctx.inputCount;
    assert(true);
  }
}
