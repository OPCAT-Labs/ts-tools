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
 * Invalid contract: accesses ctx.hashPrevouts with ANYONECANPAY sighash type
 * This should throw a transpiler error because ANYONECANPAY modes have
 * empty hashPrevouts (32 zero bytes).
 */
export class SighashAnyonecanpayHashPrevouts extends SmartContract {
  @method({ sigHashType: SigHashType.ANYONECANPAY_ALL })
  public unlock(sig: Sig, pubKey: PubKey) {
    // This should cause a transpiler error:
    // ctx.hashPrevouts cannot be accessed with ANYONECANPAY sighash
    const hashPrevouts: ByteString = this.ctx.hashPrevouts;
    assert(hashPrevouts.length > 0n, 'hashPrevouts should not be empty');
    assert(this.checkSig(sig, pubKey), 'signature check failed');
  }
}
