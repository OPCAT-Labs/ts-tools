import { method, SmartContract, assert, toByteString, sha256 } from '@scrypt-inc/scrypt-ts-btc';

// access this.ctx in private function

export class CTX extends SmartContract {
  @method()
  public unlock(n: bigint) {
    const locktime = this.ctx.nLockTime;

    const version = this.ctx.nVersion;

    const shaPrevouts = this.ctx.shaPrevouts;

    const hashSpentAmounts = this.ctx.shaSpentAmounts;

    const hashSpentScripts = this.ctx.shaSpentScripts;

    const hashSequences = this.ctx.shaSequences;

    const spendType = this.ctx.spendType;

    const inputIndex = this.ctx.inputIndex;

    const inputIndexVal = this.ctx.inputIndexVal;

    const hashTapLeaf = this.ctx.tapLeafHash;

    const keyVer = this.ctx.keyVersion;

    const codeSeparator = this.ctx.codeSepPos;

    const _e = this.ctx._eWithoutLastByte;

    const eLastByte = this.ctx._eLastByte;

    // // const sequence = this.ctx.sequence;

    // // const sigHashType = this.ctx.sigHashType;

    const preScript = this.ctx.spentScripts[0];

    const outputIndex = this.ctx.prevout.outputIndex;

    const spentTxhash = this.ctx.prevout.txHash;

    const prevouts = this.ctx.prevouts;

    const outputs = toByteString('');
    const hashOutputs = sha256(outputs);

    assert(hashOutputs == this.ctx.shaOutputs, 'hashOutputs mismatch');

    assert(n >= 0);

    assert(this.f1(n));
  }

  @method()
  f1(n: bigint): boolean {
    const hashOutputs = this.ctx.shaOutputs;

    const locktime = this.ctx.nLockTime;

    const version = this.ctx.nVersion;

    // const script = this.ctx.utxo.script;

    // const value = this.ctx.utxo.value;

    // const outputIndex = this.ctx.utxo.outpoint.outputIndex;

    // const txid = this.ctx.utxo.outpoint.txid;

    const shaPrevouts = this.ctx.shaPrevouts;

    const hashSequence = this.ctx.shaSequences;

    // const sequence = this.ctx.sequence;

    // const sigHashType = this.ctx.sigHashType;

    assert(n >= 0);

    return true;
  }
}
