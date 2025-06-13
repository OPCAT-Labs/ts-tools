import {
  ByteString,
} from '../types/index.js';
import { assert } from '../fns/assert.js';
import { SpentDataHashes } from '../types/structs.js';

/**
 * @ignore
 * @param prevout
 * @param stateHashes
 * @param stateHash
 * @returns
 */
export function checkInputStateHashImpl(
  inputIndex: number,
  stateHashes: SpentDataHashes,
  stateHash: ByteString,
) {
  assert(stateHashes[inputIndex] == stateHash, 'stateHash mismatch');
}
