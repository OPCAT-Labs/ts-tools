import { method, SmartContract, assert, Sig, PubKey } from '@opcat-labs/scrypt-ts-opcat';

// Local SigHashType object for decorator parameters
// This is needed because const enum is not available at runtime in tsx
const SigHashType = {
  ALL: 0x01,
  NONE: 0x02,
  SINGLE: 0x03,
  ANYONECANPAY_ALL: 0x81,
  ANYONECANPAY_NONE: 0x82,
  ANYONECANPAY_SINGLE: 0x83,
} as const;

/**
 * Invalid contract: uses buildChangeOutput() with ANYONECANPAY_SINGLE sighash type
 * This should throw a transpiler error because buildChangeOutput() can only be used with
 * ALL or ANYONECANPAY_ALL sighash types.
 */
export class SigHashChangeSINGLE extends SmartContract {
  @method({ sigHashType: SigHashType.ANYONECANPAY_SINGLE })
  public unlock(sig: Sig, pubKey: PubKey) {
    // This should cause a transpiler error:
    // buildChangeOutput() requires sigHashType ALL or ANYONECANPAY_ALL
    const outputs = this.buildChangeOutput();
    assert(this.checkOutputs(outputs), 'outputs mismatch');
    assert(this.checkSig(sig, pubKey), 'signature check failed');
  }
}
