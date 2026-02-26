import { method, SmartContract, assert, Sig, PubKey, ByteString } from '@opcat-labs/scrypt-ts-opcat';

// Local SigHashType object for decorator parameters
const SigHashType = {
  ALL: 0x01,
  NONE: 0x02,
  SINGLE: 0x03,
  ANYONECANPAY: 0x80,
  ANYONECANPAY_ALL: 0x81,
  ANYONECANPAY_NONE: 0x82,
  ANYONECANPAY_SINGLE: 0x83,
} as const;

/**
 * Invalid contract: uses checkOutputs() with SIGHASH_NONE sighash type
 * This should throw a transpiler error because checkOutputs() cannot be used with
 * SIGHASH_NONE or ANYONECANPAY_NONE (hashOutputs is empty).
 */
export class SighashCheckOutputsNone extends SmartContract {
  @method({ sigHashType: SigHashType.NONE })
  public unlock(sig: Sig, pubKey: PubKey, outputs: ByteString) {
    // This should cause a transpiler error:
    // checkOutputs() requires hashOutputs to be non-empty
    assert(this.checkOutputs(outputs), 'outputs mismatch');
    assert(this.checkSig(sig, pubKey), 'signature check failed');
  }
}
