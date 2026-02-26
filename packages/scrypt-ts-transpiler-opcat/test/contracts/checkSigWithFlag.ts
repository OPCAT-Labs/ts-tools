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
 */
export class CheckSigWithFlagTest extends SmartContract {
  @method()
  public unlockWithAllFlag(sig: Sig, pubKey: PubKey) {
    // Verify signature has SIGHASH_ALL flag (0x01)
    assert(this.checkSigWithFlag(sig, pubKey, 1n), 'signature must have SIGHASH_ALL flag');
  }

  @method()
  public unlockWithNoneFlag(sig: Sig, pubKey: PubKey) {
    // Verify signature has SIGHASH_NONE flag (0x02)
    assert(this.checkSigWithFlag(sig, pubKey, 2n), 'signature must have SIGHASH_NONE flag');
  }

  @method()
  public unlockWithAnyonecanpayAllFlag(sig: Sig, pubKey: PubKey) {
    // Verify signature has ANYONECANPAY_ALL flag (0x81 = 129)
    assert(this.checkSigWithFlag(sig, pubKey, 129n), 'signature must have ANYONECANPAY_ALL flag');
  }

  @method()
  public unlockWithDynamicFlag(sig: Sig, pubKey: PubKey, expectedFlag: bigint) {
    // Verify signature has the dynamically provided flag
    assert(this.checkSigWithFlag(sig, pubKey, expectedFlag), 'signature flag mismatch');
  }
}
