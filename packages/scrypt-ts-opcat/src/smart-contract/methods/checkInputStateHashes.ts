import {
  ByteString,
} from '../types/index.js';
import { assert } from '../fns/assert.js';
import { hash256 } from '../fns/hashes.js';
import { SpentDataHashes } from '../types/structs.js';

/**
 * Verifies that the hash of the input data matches the expected state hash.
 * @param stateHash - The expected hash value of the state
 * @param data - The input data to be hashed and verified
 * @throws Throws an error if the hash of the data does not match the stateHash
 */
export function checkInputStateHashesImpl(
  hashSpentDatas: ByteString,
  spentDataHashes: SpentDataHashes,
) {
  assert(hash256(spentDataHashes) == hashSpentDatas, 'spentDataHashes mismatch');
}
