import { assert } from '../fns/assert.js';
import { method } from '../decorators.js';
import { slice } from '../fns/byteString.js';
import { SmartContractLib } from '../smartContractLib.js';
import { ByteString, UInt32 } from '../types/primitives.js';
import { SpentDataHashes } from '../types/structs.js';
import { TX_OUTPUT_DATA_HASH_LEN } from '../consts.js';

/**
 * Verifies that the hash of a raw state matches the corresponding spent data hash in the transaction.
 * @param t_inputIndex - The index of the input being verified
 * @param stateHash - The hash of the serialized raw state to check
 * @param t_spentDataHashes - Trustable spent data hashes from the transaction
 * @throws Throws an assertion error if the state hash doesn't match the spent data hash
 * @category Library
 * @onchain
 */
export class StateUtils extends SmartContractLib {
  /**
   * Check if the dataHash of the passed-in raw state matches the spent data hash
   * @param rawState passed-in raw state after serialization
   * @param t_spentDataHashes trustable spent data hashes
   * @param t_inputIndex trustable input index
   */
  @method()
  static checkInputState(
    t_inputIndex: UInt32,
    stateHash: ByteString,
    t_spentDataHashes: SpentDataHashes,
  ): void {
    assert(
      slice(
        t_spentDataHashes, 
        t_inputIndex * TX_OUTPUT_DATA_HASH_LEN, 
        (t_inputIndex + 1n) * TX_OUTPUT_DATA_HASH_LEN
      ) == stateHash, 
      'dataHash of state mismatch'
    );
  }
}
