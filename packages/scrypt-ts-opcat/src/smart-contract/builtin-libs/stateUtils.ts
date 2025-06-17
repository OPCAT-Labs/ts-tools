import { assert } from '../fns/assert.js';
import { method } from '../decorators.js';
import { slice } from '../fns/byteString.js';
import { SmartContractLib } from '../smartContractLib.js';
import { ByteString, Int32, UInt32 } from '../types/primitives.js';
import { SpentDataHashes } from '../types/structs.js';
import { TX_OUTPUT_DATA_HASH_LEN } from '../consts.js';
import { sha256 } from '../fns/hashes.js';

/**
 * spentDatas library
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
    rawState: ByteString,
    t_spentDataHashes: SpentDataHashes,
    t_inputIndex: UInt32,
  ): void {
    assert(
      slice(
        t_spentDataHashes, 
        t_inputIndex * TX_OUTPUT_DATA_HASH_LEN, 
        (t_inputIndex + 1n) * TX_OUTPUT_DATA_HASH_LEN
      ) == sha256(rawState), 
      'dataHash of state mismatch'
    );
  }
}
