import { assert } from '../fns/assert.js';
import { method } from '../decorators.js';
import { slice } from '../fns/byteString.js';
import { SmartContractLib } from '../smartContractLib.js';
import { ByteString, Int32, UInt32 } from '../types/primitives.js';
import { SpentDataHashes } from '../types/structs.js';
import { sha256 } from '../fns/hashes.js';

/**
 * spentDatas library
 * @category Library
 * @onchain
 */
export class StateUtils extends SmartContractLib {
  /**
   * Use trustable hashRoot and outputIndex to check passed-in stateHashes and stateHash
   * @param stateHashes passed-in stateHashes
   * @param stateHash passed-in stateHash
   * @param t_hashRoot trustable hashRoot
   * @param t_outputIndex trustable outputIndex
   */
  @method()
  static checkStateHash(
    dataHash: ByteString,
    t_spentDataHashes: SpentDataHashes,
    t_inputIndex: UInt32,
  ): void {
    assert(slice(t_spentDataHashes, t_inputIndex * 32n, (t_inputIndex + 1n) * 32n) == dataHash, 'dataHash mismatch');
  }


  @method()
  static checkInputState(
    stateHashesProof: SpentDataHashes,
    data: ByteString,
    inputIndex: Int32,
  ): void {
    // const inputStateHash = stateHashesProof[Number(inputIndex)];
    // assert(inputStateHash ==
    //     sha256(data),
    //   `invalid data`,
    // );
  }

}
