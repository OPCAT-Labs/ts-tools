import { assert, method, SmartContract } from '@scrypt-inc/scrypt-ts-btc';

/// a transpilable contract for ctx, will be transpiled successfully
export class CTX3 extends SmartContract {
  @method()
  public unlock() {
    this.ctx.nVersion;
    this.ctx.nLockTime;
    this.ctx.shaPrevouts;
    this.ctx.shaSpentAmounts;
    this.ctx.shaSpentScripts;
    this.ctx.shaSequences;
    this.ctx.shaOutputs;
    this.ctx.spendType;
    this.ctx.inputIndex;
    this.ctx.tapLeafHash;
    this.ctx.keyVersion;
    this.ctx.codeSepPos;
    this.ctx._eWithoutLastByte;
    this.ctx._eLastByte;

    this.ctx.inputIndexVal;
    this.ctx.prevouts;
    this.ctx.spentScripts[0];
    this.ctx.spentAmounts[0];

    this.ctx.prevout.outputIndex;
    this.ctx.prevout.txHash;
    this.ctx.spentScript;
    this.ctx.spentAmount;
    this.ctx.inputCount;
    this.ctx.nextStateHashes;

    assert(true);
  }
}
