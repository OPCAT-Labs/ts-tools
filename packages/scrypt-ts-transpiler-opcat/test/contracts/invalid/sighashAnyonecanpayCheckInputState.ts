import { method, SmartContract, assert, ByteString } from '@opcat-labs/scrypt-ts-opcat';

// Local SigHashType object for decorator parameters
const SigHashType = {
  ALL: 0x01,
  NONE: 0x02,
  SINGLE: 0x03,
  ANYONECANPAY_ALL: 0x81,
  ANYONECANPAY_NONE: 0x82,
  ANYONECANPAY_SINGLE: 0x83,
} as const;

export type S = {
    a: bigint
}

/**
 * Invalid contract: uses checkInputState() with ANYONECANPAY sighash type
 * This should throw a transpiler error because ANYONECANPAY modes have
 * empty spentDataHashes which checkInputState depends on.
 */
export class SighashAnyonecanpayCheckInputState extends SmartContract<S> {
  @method({ sigHashType: SigHashType.ANYONECANPAY_ALL })
  public unlock(idx: bigint, serializedState: ByteString) {
    // This should cause a transpiler error:
    // checkInputState() cannot be used with ANYONECANPAY sighash
    this.checkInputState(idx, serializedState);
    assert(true);
  }
}
