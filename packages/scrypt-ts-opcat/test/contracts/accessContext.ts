import { SmartContract, method, assert, hash256, intToByteString, slice, toByteString } from '@opcat-labs/scrypt-ts-opcat';


export class AccessContext extends SmartContract {
  @method()
  public unlock() {
    assert(this.ctx.nVersion === toByteString('01000000'), 'nVersion is not 1');

    // verify this.ctx.nLockTime
    assert(this.ctx.nLockTime === 0n, 'nLockTime is not correct');

    assert(hash256(this.ctx.prevouts) === this.ctx.hashPrevouts, 'hashPrevouts is not correct');
    // check prevout
    assert(this.ctx.prevout.txHash + intToByteString(this.ctx.prevout.outputIndex, 4n) === slice(this.ctx.prevouts, this.ctx.inputIndex*36n, this.ctx.inputIndex + 1n*36n), `invalid prevout`);
    assert(hash256(this.ctx.spentDataHashes) === this.ctx.hashSpentDataHashes, 'spentDataHashes is not correct');
    assert(hash256(this.ctx.spentScriptHashes) === this.ctx.hashSpentScriptHashes, 'hashPrevouts is not correct');
    assert(hash256(this.ctx.spentAmounts) === this.ctx.hashSpentAmounts, 'hashPrevouts is not correct');
    assert(this.ctx.inputIndex === 0n, 'inputIndex is not 0');

    assert(this.ctx.inputCount === 2n, 'inputCount is not 2');

    // verify this.ctx.sigHashType
    // @note since we are using tapLeafHash, not using annex, so the value of spendType is 2n
    assert(this.ctx.sigHashType === 1n, 'spendType is not correct');

    const outputs = this.buildChangeOutput();
    assert(hash256(outputs) === this.ctx.hashOutputs, 'hashOutputs is not correct');
  }
}
