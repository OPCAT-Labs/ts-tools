import { method, SmartContract, assert, toByteString, sha256 } from '@opcat-labs/scrypt-ts-opcat';

// access this.ctx in private function

export class CTX extends SmartContract {
  @method()
  public unlock(n: bigint) {


    // txPreimage
    const nVersion = this.ctx.nVersion;
    const hashPrevouts = this.ctx.hashPrevouts;
    const spentScriptHash = this.ctx.spentScriptHash;
    const spentDataHash = this.ctx.spentDataHash;
    const value = this.ctx.value;
    const nSequence = this.ctx.nSequence;
    const hashSpentAmounts = this.ctx.hashSpentAmounts;
    const hashSpentScriptHashes = this.ctx.hashSpentScriptHashes;
    const hashSpentDataHashes = this.ctx.hashSpentDataHashes;
    const hashSequences = this.ctx.hashSequences;
    const hashOutputs = this.ctx.hashOutputs;
    const inputIndex = this.ctx.inputIndex;
    const nLockTime = this.ctx.nLockTime;
    const sigHashType = this.ctx.sigHashType;

    // // ParamCtx
    const prevouts = this.ctx.prevouts;
    const spentScriptHashes = this.ctx.spentScriptHashes;
    const spentAmounts = this.ctx.spentAmounts;
    const spentDataHashes = this.ctx.spentDataHashes;

    // // DerivedCtx
    const prevout = this.ctx.prevout;
    const inputCount = this.ctx.inputCount;
  

    assert(n >= 0);

    assert(this.f1(n));
  }

  @method()
  f1(n: bigint): boolean {
    
    
    // txPreimage
    const nVersion = this.ctx.nVersion;
    const hashPrevouts = this.ctx.hashPrevouts;
    const spentScriptHash = this.ctx.spentScriptHash;
    const spentDataHash = this.ctx.spentDataHash;
    const value = this.ctx.value;
    const nSequence = this.ctx.nSequence;
    const hashSpentAmounts = this.ctx.hashSpentAmounts;
    const hashSpentScriptHashes = this.ctx.hashSpentScriptHashes;
    const hashSpentDataHashes = this.ctx.hashSpentDataHashes;
    const hashSequences = this.ctx.hashSequences;
    const hashOutputs = this.ctx.hashOutputs;
    const inputIndex = this.ctx.inputIndex;
    const nLockTime = this.ctx.nLockTime;
    const sigHashType = this.ctx.sigHashType;

    // // ParamCtx
    const prevouts = this.ctx.prevouts;
    const spentScriptHashes = this.ctx.spentScriptHashes;
    const spentAmounts = this.ctx.spentAmounts;
    const spentDataHashes = this.ctx.spentDataHashes;

    // // DerivedCtx
    const prevout = this.ctx.prevout;
    const inputCount = this.ctx.inputCount;

    assert(n >= 0);

    return true;
  }
}
