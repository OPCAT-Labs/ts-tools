import {
  SmartContract,
  method,
  assert,
  Sig,
  PubKey,
} from '@opcat-labs/scrypt-ts-opcat';

// Local SigHashType constants
const SigHashType = {
  ALL: 0x01,
  NONE: 0x02,
  SINGLE: 0x03,
  ANYONECANPAY_ALL: 0x81,
} as const;

/**
 * Test contract for checkSigWithFlag method.
 * Demonstrates verifying signature's sighash flag matches an explicit flag parameter.
 * Each method uses a sigHashType decorator that matches the expected flag.
 */
export class CheckSigWithFlagTest extends SmartContract {
  /**
   * Unlock with explicit SIGHASH_ALL flag verification (0x01 = 1)
   */
  @method({ sigHashType: SigHashType.ALL })
  public unlockWithAllFlag(sig: Sig, pubKey: PubKey) {
    // Verify signature has SIGHASH_ALL flag
    assert(this.checkSigWithFlag(sig, pubKey, 1n), 'signature must have SIGHASH_ALL flag');
  }

  /**
   * Unlock with explicit SIGHASH_NONE flag verification (0x02 = 2)
   */
  @method({ sigHashType: SigHashType.NONE })
  public unlockWithNoneFlag(sig: Sig, pubKey: PubKey) {
    // Verify signature has SIGHASH_NONE flag
    assert(this.checkSigWithFlag(sig, pubKey, 2n), 'signature must have SIGHASH_NONE flag');
  }

  /**
   * Unlock with explicit ANYONECANPAY_ALL flag verification (0x81 = 129)
   */
  @method({ sigHashType: SigHashType.ANYONECANPAY_ALL })
  public unlockWithAnyonecanpayAllFlag(sig: Sig, pubKey: PubKey) {
    // Verify signature has ANYONECANPAY_ALL flag
    assert(this.checkSigWithFlag(sig, pubKey, 129n), 'signature must have ANYONECANPAY_ALL flag');
  }

  /**
   * Unlock with dynamic flag verification - flag is passed as parameter
   * Note: This method defaults to SIGHASH_ALL, so only flag=1 will work for dynamic verification
   */
  @method({ sigHashType: SigHashType.ALL })
  public unlockWithDynamicFlag(sig: Sig, pubKey: PubKey, expectedFlag: bigint) {
    // Verify signature has the dynamically provided flag
    assert(this.checkSigWithFlag(sig, pubKey, expectedFlag), 'signature flag mismatch');
  }
}
