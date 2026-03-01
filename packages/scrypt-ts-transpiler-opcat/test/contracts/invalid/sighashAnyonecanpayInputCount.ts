import { method, SmartContract, assert, Sig, PubKey } from '@opcat-labs/scrypt-ts-opcat';

// Local SigHashType object for decorator parameters
const SigHashType = {
  ALL: 0x01,
  NONE: 0x02,
  SINGLE: 0x03,
  ANYONECANPAY_ALL: 0x81,
  ANYONECANPAY_NONE: 0x82,
  ANYONECANPAY_SINGLE: 0x83,
} as const;

/**
 * Invalid contract: accesses ctx.inputCount with ANYONECANPAY sighash type
 * This should throw a transpiler error because inputCount is not defined
 * in ANYONECANPAY modes (requires spentAmounts which is empty).
 */
export class SighashAnyonecanpayInputCount extends SmartContract {
  @method({ sigHashType: SigHashType.ANYONECANPAY_ALL })
  public unlock(sig: Sig, pubKey: PubKey) {
    // This should cause a transpiler error:
    // ctx.inputCount cannot be accessed with ANYONECANPAY sighash
    const inputCount: bigint = this.ctx.inputCount;
    assert(inputCount >= 1n, 'inputCount should be >= 1');
    assert(this.checkSig(sig, pubKey), 'signature check failed');
  }
}
