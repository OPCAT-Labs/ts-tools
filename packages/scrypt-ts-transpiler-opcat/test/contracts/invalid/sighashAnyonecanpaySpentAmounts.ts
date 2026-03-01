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
 * Invalid contract: accesses ctx.spentAmounts with ANYONECANPAY sighash type
 * This should throw a transpiler error because ANYONECANPAY modes have
 * empty hashSpentAmounts (32 zero bytes), so verification would fail.
 */
export class SighashAnyonecanpaySpentAmounts extends SmartContract {
  @method({ sigHashType: SigHashType.ANYONECANPAY_NONE })
  public unlock(sig: Sig, pubKey: PubKey) {
    // This should cause a transpiler error:
    // ctx.spentAmounts cannot be accessed with ANYONECANPAY sighash
    const spentAmounts = this.ctx.spentAmounts;
    assert(spentAmounts.length > 0n, 'spentAmounts should not be empty');
    assert(this.checkSig(sig, pubKey), 'signature check failed');
  }
}
