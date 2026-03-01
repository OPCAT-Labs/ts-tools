import { method, SmartContract, assert, Sig, PubKey, ByteString } from '@opcat-labs/scrypt-ts-opcat';

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
 * Invalid contract: accesses ctx.hashOutputs with SIGHASH_NONE
 * This should throw a transpiler error because hashOutputs is empty
 * in NONE mode.
 */
export class SighashNoneHashOutputs extends SmartContract {
  @method({ sigHashType: SigHashType.NONE })
  public unlock(sig: Sig, pubKey: PubKey) {
    // This should cause a transpiler error:
    // ctx.hashOutputs cannot be accessed with sighash NONE
    const hashOutputs: ByteString = this.ctx.hashOutputs;
    assert(hashOutputs.length > 0n, 'hashOutputs should not be empty');
    assert(this.checkSig(sig, pubKey), 'signature check failed');
  }
}
