import { assert } from '../fns/assert.js';
import { TX_INPUT_COUNT_MAX } from '../consts.js';
import { method } from '../decorators.js';
import { toByteString } from '../fns/byteString.js';
import { hash256, sha256 } from '../fns/hashes.js';
import { SmartContractLib } from '../smartContractLib.js';
import { ByteString, Int32 } from '../types/primitives.js';
import {  SpentDataHashes } from '../types/structs.js';

/**
 * spentDatas library
 * @category Library
 * @onchain
 */
export class StateUtils extends SmartContractLib {
  
  /**
   * Check if state of prev output corresponding to an input
   * @param stateHashesProof input state hashes proof
   * @param spentDatasHash state hash of prev output corresponding to this input
   */
  @method()
  static checkInputStateHashes(
    stateHashesProof: SpentDataHashes,
    stateHashes: ByteString,
  ): void {
    
    let _stateHashes = toByteString('');
    for (let index = 0; index < TX_INPUT_COUNT_MAX; index++) {
       _stateHashes += stateHashesProof[index];
    }

    assert(hash256(_stateHashes) ==
        stateHashes,
      `invalid stateHashesProof`,
    );
  }


  @method()
  static checkInputState(
    stateHashesProof: SpentDataHashes,
    data: ByteString,
    inputIndex: Int32,
  ): void {
    const inputStateHash = stateHashesProof[Number(inputIndex)];
    assert(inputStateHash ==
        sha256(data),
      `invalid data`,
    );
  }

}
