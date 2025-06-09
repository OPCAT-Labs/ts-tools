import { TxUtils } from '../builtin-libs/txUtils.js';
import {
  TX_VERSION_BYTE_LEN,
  TX_INPUT_COUNT_BYTE_LEN,
  TX_OUTPUT_COUNT_BYTE_LEN,
  TX_INPUT_COUNT_MAX,
  TX_SEGWIT_INPUT_BYTE_LEN,
  STATE_HASH_BYTE_LEN,
  STATE_OUTPUT_COUNT_MAX,
} from '../consts.js';
import { len, int32ToByteString, toByteString } from '../fns/byteString.js';
import { hash160, hash256 } from '../fns/hashes.js';
import {
  InputStateProof,
  ByteString,
  Int32,
  StateHashes,
  HashRootTxHashPreimage,
} from '../types/index.js';
import { indexValueToBytes } from '../serializer.js';
import { assert } from '../fns/assert.js';

/**
 * @ignore
 * @param inputStateProof
 * @param stateHash
 * @param prevout
 * @returns
 */
export function checkInputStateHashImpl(
  inputStateProof: InputStateProof,
  stateHash: ByteString,
  prevout: ByteString,
) {
  const prevTxHash = getTxIdFromTxHashPreimage(inputStateProof.txHashPreimage);
  const prevOutputIndex = indexValueToBytes(inputStateProof.outputIndexVal);
  assert(prevTxHash + prevOutputIndex == prevout, 'prevout mismatch');

  checkStateHash(
    inputStateProof.stateHashes,
    stateHash,
    inputStateProof.txHashPreimage.hashRoot,
    inputStateProof.outputIndexVal,
  );

  return true;
}

function getTxIdFromTxHashPreimage(preimage: HashRootTxHashPreimage): ByteString {
  const suffix =
    preimage.suffixList[0] +
    preimage.suffixList[1] +
    preimage.suffixList[2] +
    preimage.suffixList[3];
  // build prefix, including version, the number of inputs, inputs, and the number of outputs
  assert(len(preimage.version) == TX_VERSION_BYTE_LEN);
  const prefix =
    preimage.version +
    int32ToByteString(preimage.inputCountVal) +
    preimage.inputList[0] +
    preimage.inputList[1] +
    preimage.inputList[2] +
    preimage.inputList[3] +
    preimage.inputList[4] +
    preimage.inputList[5] +
    int32ToByteString(preimage.outputCountVal);
  let expectedLen = TX_VERSION_BYTE_LEN + TX_INPUT_COUNT_BYTE_LEN + TX_OUTPUT_COUNT_BYTE_LEN;
  for (let i = 0; i < TX_INPUT_COUNT_MAX; i++) {
    if (i < preimage.inputCountVal) {
      expectedLen += TX_SEGWIT_INPUT_BYTE_LEN;
    }
  }
  assert(len(prefix) == expectedLen);
  // build state output
  let stateOutput = TxUtils.buildStateHashRootOutput(preimage.hashRoot);

  assert(
    len(preimage.suffixList[0]) === len(TxUtils.STATE_HASH_ROOT_SCRIPT_PREFIX),
    `the suffix[0] of the preimage should be the size of ${len(TxUtils.STATE_HASH_ROOT_SCRIPT_PREFIX)} bytes`,
  );

  if (preimage.hashRoot === TxUtils.NON_STATES_HASH_ROOT) {
    // the first suffix should be the same sizea as the state root hash prefix
    assert(len(preimage.suffixList[0]) === 6n, 'the suffix[0] should be the size of 6 bytes');
    // prevent a state tx being used as a non-states tx
    assert(
      preimage.suffixList[0] !== TxUtils.STATE_HASH_ROOT_SCRIPT_PREFIX,
      'the suffix[0] should not be a state root hash prefix for a non-states tx',
    );
    // do not append state hash root output when the it's a non-states tx
    stateOutput = toByteString('');
  }

  // build raw tx and return the tx hash
  return hash256(prefix + stateOutput + suffix);
}

function checkStateHash(
  stateHashes: StateHashes,
  stateHash: ByteString,
  hashRoot: ByteString,
  outputIndex: Int32,
) {
  let stateRoots = toByteString('');
  for (let i = 0; i < STATE_OUTPUT_COUNT_MAX; i++) {
    const stateHash = stateHashes[i];
    const stateHashLen = len(stateHash);
    assert(stateHashLen == 0n || stateHashLen == STATE_HASH_BYTE_LEN);
    stateRoots += hash160(stateHash);
  }
  assert(hash160(stateRoots) == hashRoot, 'stateHashes and hashRoot mismatch');

  if (outputIndex < 1) {
    throw new Error('the outputIndex of a stateful covenant UTXO must be greater than 0');
  }

  assert(
    stateHash == stateHashes[Number(outputIndex - 1n)],
    `stateHash and stateHashes mismatch: ${stateHash} vs ${stateHashes[Number(outputIndex - 1n)]}`,
  );
}
