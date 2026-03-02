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
 * Invalid contract: accesses ctx.inputIndex with ANYONECANPAY sighash type
 * This should throw a transpiler error because inputIndex is not defined
 * in ANYONECANPAY modes.
 */
export class SighashAnyonecanpayInputIndex extends SmartContract {
  @method({ sigHashType: SigHashType.ANYONECANPAY_ALL })
  public unlock(sig: Sig, pubKey: PubKey) {
    // This should cause a transpiler error:
    // ctx.inputIndex cannot be accessed with ANYONECANPAY sighash
    const inputIndex: bigint = this.ctx.inputIndex;
    assert(inputIndex >= 0n, 'inputIndex should be >= 0');
    assert(this.checkSig(sig, pubKey), 'signature check failed');
  }
}
