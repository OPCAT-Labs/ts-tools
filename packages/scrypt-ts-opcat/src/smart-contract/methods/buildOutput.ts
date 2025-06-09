import { assert } from '../fns/assert.js';
import { toByteString, len, int32ToByteString } from '../fns/byteString.js';
import {
  STATE_HASH_ROOT_BYTE_LEN,
  TX_OUTPUT_SATOSHI_BYTE_LEN,
  TX_P2TR_OUTPUT_SCRIPT_BYTE_LEN,
} from '../consts.js';
import { Contextual } from '../types/context.js';
import { ByteString, Int32, StateHashes } from '../types/index.js';
import { hash160 } from '../fns/index.js';
import { TxUtils } from '../builtin-libs/txUtils.js';

/**
 * @ignore
 * @param psbt
 * @returns
 */
export function buildChangeOutputImpl(psbt: Contextual): ByteString {
  const changeInfo = psbt.getChangeInfo();
  if (len(changeInfo.satoshis) === 0n) {
    return toByteString('');
  }

  const nlen = len(changeInfo.script);
  assert(nlen <= TX_P2TR_OUTPUT_SCRIPT_BYTE_LEN);

  return changeInfo.satoshis + int32ToByteString(nlen) + changeInfo.script;
}

/**
 * @ignore
 * @param stateRoots
 * @param stateCount
 * @param stateOutputs
 * @param nextStateHashes
 * @returns
 */
export function buildStateOutputsImpl(
  stateRoots: ByteString,
  stateCount: Int32,
  stateOutputs: ByteString,
  nextStateHashes: StateHashes,
): ByteString {
  const hashRoot = hash160(stateRoots + padEmptyStateRoots(stateCount));
  checkStateHashRoot(nextStateHashes, hashRoot);
  const hashRootOutput = buildStateHashRootOutput(hashRoot);
  return hashRootOutput + stateOutputs;
}

function padEmptyStateRoots(stateCount: Int32): ByteString {
  const emptySlots = 5n - stateCount;
  assert(emptySlots >= 0n);
  let padding = toByteString('');
  for (let i = 0; i < 5; i++) {
    if (i < emptySlots) {
      padding += hash160(toByteString(''));
    }
  }
  return padding;
}

function checkStateHashRoot(stateHashes: StateHashes, hashRoot: ByteString): void {
  let stateRoots = toByteString('');
  for (let i = 0; i < 5; i++) {
    const stateHash = stateHashes[i];
    const stateHashLen = len(stateHash);
    assert(stateHashLen == 0n || stateHashLen == 20n);
    stateRoots += hash160(stateHash);
  }
  assert(hash160(stateRoots) == hashRoot, 'stateHashes and hashRoot mismatch');
}

function buildOutput(script: ByteString, satoshis: ByteString): ByteString {
  const scriptLen = len(script);
  assert(scriptLen > 0 && scriptLen <= TX_P2TR_OUTPUT_SCRIPT_BYTE_LEN);
  assert(len(satoshis) == TX_OUTPUT_SATOSHI_BYTE_LEN);
  return satoshis + int32ToByteString(scriptLen) + script;
}

function buildStateHashRootOutput(hashRoot: ByteString): ByteString {
  assert(len(hashRoot) == STATE_HASH_ROOT_BYTE_LEN);
  return buildOutput(toByteString('6a1863617401') + hashRoot, TxUtils.ZERO_SATS);
}
