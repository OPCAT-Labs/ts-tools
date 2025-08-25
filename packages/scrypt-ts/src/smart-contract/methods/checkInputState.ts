import {
  ByteString,
} from '../types/index.js';
import { assert } from '../fns/assert.js';
import { sha256 } from '../fns/hashes.js';


/**
 * Verifies that the hash of the input data matches the expected state hash.
 * @ignore
 * @param stateHash - The expected hash value of the state
 * @param data - The input data to be hashed and verified
 * @throws Throws an error if the hash of the data does not match the stateHash
 */
export function checkInputStateImpl(
  stateHash: ByteString,
  data: ByteString,
) {
  assert(sha256(data) == stateHash, 'stateHash mismatch');
}
