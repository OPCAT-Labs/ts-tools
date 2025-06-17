import {
  ByteString,
} from '../types/index.js';
import { assert } from '../fns/assert.js';
import { hash256 } from '../fns/hashes.js';
import { SpentDataHashes } from '../types/structs.js';
import { TX_INPUT_COUNT_MAX } from '../consts.js';
import { toByteString } from '../fns/byteString.js';


/**
 * Verifies that the hash of the input data matches the expected state hash.
 * @param stateHash - The expected hash value of the state
 * @param data - The input data to be hashed and verified
 * @throws Throws an error if the hash of the data does not match the stateHash
 */
export function checkInputStateHashesImpl(
  inputCount: number,
  hashSpentDatas: ByteString,
  spentDataHashes: SpentDataHashes,
) {

  let spentDataHashesJoin: ByteString = toByteString('');
  for (let index = 0; index < TX_INPUT_COUNT_MAX; index++) {
    if(index < inputCount) {
      spentDataHashesJoin += spentDataHashes[index];
    }
  }
  assert(hash256(spentDataHashesJoin) == hashSpentDatas, 'stateHash mismatch');
}
