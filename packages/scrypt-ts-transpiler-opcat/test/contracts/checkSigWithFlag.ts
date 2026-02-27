import { method, SmartContract, assert, Sig, PubKey } from '@opcat-labs/scrypt-ts-opcat';

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
  @method({ sigHashType: SigHashType.ALL })
  public unlockWithAllFlag(sig: Sig, pubKey: PubKey) {
    // Verify signature has SIGHASH_ALL flag (0x01)
    assert(this.checkSigWithFlag(sig, pubKey, 1n), 'signature must have SIGHASH_ALL flag');
  }

  @method({ sigHashType: SigHashType.NONE })
  public unlockWithNoneFlag(sig: Sig, pubKey: PubKey) {
    // Verify signature has SIGHASH_NONE flag (0x02)
    assert(this.checkSigWithFlag(sig, pubKey, 2n), 'signature must have SIGHASH_NONE flag');
  }

  @method({ sigHashType: SigHashType.ANYONECANPAY_ALL })
  public unlockWithAnyonecanpayAllFlag(sig: Sig, pubKey: PubKey) {
    // Verify signature has ANYONECANPAY_ALL flag (0x81 = 129)
    assert(this.checkSigWithFlag(sig, pubKey, 129n), 'signature must have ANYONECANPAY_ALL flag');
  }

  @method({ sigHashType: SigHashType.ALL })
  public unlockWithDynamicFlag(sig: Sig, pubKey: PubKey, expectedFlag: bigint) {
    // Verify signature has the dynamically provided flag
    // Note: This method defaults to SIGHASH_ALL, but checkSigWithFlag will verify against expectedFlag
    assert(this.checkSigWithFlag(sig, pubKey, expectedFlag), 'signature flag mismatch');
  }

  /**
   * Test method where decorator sigHashType (ALL) differs from checkSigWithFlag flag (NONE).
   * This demonstrates mismatch detection: the signature will be signed with ALL,
   * but checkSigWithFlag verifies for NONE, which should fail.
   */
  @method({ sigHashType: SigHashType.ALL })
  public unlockWithMismatchedFlag(sig: Sig, pubKey: PubKey) {
    // Decorator uses SIGHASH_ALL (1), but we verify for SIGHASH_NONE (2)
    // This should fail because the actual signature has flag=1 but we check for flag=2
    assert(this.checkSigWithFlag(sig, pubKey, 2n), 'signature flag mismatch expected');
  }
}
