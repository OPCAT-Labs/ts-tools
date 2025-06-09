import { AbstractContract } from '../abstractContract.js';
import {
  TX_VERSION_BYTE_LEN,
  TX_INPUT_COUNT_BYTE_LEN,
  TX_OUTPUT_COUNT_BYTE_LEN,
  TX_INPUT_COUNT_MAX,
  TX_SEGWIT_INPUT_BYTE_LEN,
  TX_OUTPUT_COUNT_MAX,
  TX_LOCKTIME_BYTE_LEN,
  TX_INPUT_PREV_TX_HASH_BYTE_LEN,
  TX_INPUT_SEQUENCE_BYTE_LEN,
  TX_OUTPUT_SATOSHI_BYTE_LEN,
  TX_P2TR_OUTPUT_SCRIPT_BYTE_LEN,
} from '../consts.js';
import { assert, hash256, int32ToByteString, len, toByteString } from '../fns/index.js';
import { indexValueToBytes } from '../serializer.js';
import { ByteString, FixedArray } from '../types/index.js';
import {
  BacktraceInfo,
  HashRootTxHashPreimage,
  TxIn,
  CompactTxHashPreimage,
} from '../types/structs.js';

/**
 * @ignore
 * @param self
 * @param backtraceInfo
 * @param genesisOutpoint
 * @returns
 */
export function backtraceToOutpointImpl(
  self: AbstractContract,
  backtraceInfo: BacktraceInfo,
  genesisOutpoint: ByteString,
): boolean {
  const res = verifyChainTxs(backtraceInfo, getInputTxPreimage(self).inputList);
  assert(
    res.prevPrevOutpoint === genesisOutpoint || res.prevPrevScript == self.ctx.spentScript,
    `can not backtrace to the genesis outpoint`,
  );
  return true;
}

/**
 * @ignore
 * @param self
 * @param backtraceInfo
 * @param genesisScript
 * @returns
 */
export function backtraceToScriptImpl(
  self: AbstractContract,
  backtraceInfo: BacktraceInfo,
  genesisScript: ByteString,
): boolean {
  const res = verifyChainTxs(backtraceInfo, getInputTxPreimage(self).inputList);
  assert(
    res.prevPrevScript == genesisScript || res.prevPrevScript == self.ctx.spentScript,
    `can not backtrace to the genesis script`,
  );
  return true;
}

function getInputTxPreimage(self: AbstractContract): HashRootTxHashPreimage {
  if (!self.ctx.inputStateProof) {
    throw new Error('inputStateProof is not available');
  }
  return self.ctx.inputStateProof.txHashPreimage;
}

function verifyChainTxs(
  backtraceInfo: BacktraceInfo,
  t_prevTxInputList: FixedArray<ByteString, typeof TX_INPUT_COUNT_MAX>,
) {
  // check if the passed prevTxInput and prevTxInputIndexVal are matched
  const prevTxInput = t_prevTxInputList[Number(backtraceInfo.prevTxInputIndexVal)];
  assert(
    prevTxInput == mergeInput(backtraceInfo.prevTxInput),
    'invalid `prevTxInput` of the argument `backtraceInfo`',
  );
  // check if prevTxHash of passed prevTxInput and prevPrevTx are matched
  const prevPrevTxHash = backtraceInfo.prevTxInput.prevTxHash;
  assert(
    prevPrevTxHash == getTxHashFromCompactTxHashPreimage(backtraceInfo.prevPrevTxPreimage),
    'invalid `prevPrevTxPreimage` of the argument `backtraceInfo`',
  );
  // all fields in backtraceInfo have been verified
  const prevPrevOutputIndex = backtraceInfo.prevTxInput.prevOutputIndexVal;
  const prevPrevScript =
    backtraceInfo.prevPrevTxPreimage.outputScriptList[Number(prevPrevOutputIndex)];
  const prevPrevOutpoint =
    prevPrevTxHash + indexValueToBytes(backtraceInfo.prevTxInput.prevOutputIndexVal);
  return { prevPrevScript, prevPrevOutpoint };
}

function getTxHashFromCompactTxHashPreimage(preimage: CompactTxHashPreimage): ByteString {
  // append version, the number of inputs, inputs, and the number of outputs
  assert(len(preimage.version) == TX_VERSION_BYTE_LEN);
  let txRaw =
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
    // there must be no empty element between inputs in the array
    if (i < preimage.inputCountVal) {
      expectedLen += TX_SEGWIT_INPUT_BYTE_LEN;
      assert(len(preimage.inputList[i]) == TX_SEGWIT_INPUT_BYTE_LEN);
    } else {
      assert(len(preimage.inputList[i]) == 0n);
    }
  }
  assert(len(txRaw) == expectedLen);
  // append outputs
  for (let i = 0; i < TX_OUTPUT_COUNT_MAX; i++) {
    const script = preimage.outputScriptList[i];
    const satoshis = preimage.outputSatoshisList[i];
    if (i < preimage.outputCountVal) {
      txRaw += buildOutput(script, satoshis);
    } else {
      assert(len(script) == 0n);
      assert(len(satoshis) == 0n);
    }
  }
  // append locktime and return the tx hash
  assert(len(preimage.locktime) == TX_LOCKTIME_BYTE_LEN);
  return hash256(txRaw + preimage.locktime);
}

function buildOutput(script: ByteString, satoshis: ByteString): ByteString {
  const scriptLen = len(script);
  assert(scriptLen > 0 && scriptLen <= TX_P2TR_OUTPUT_SCRIPT_BYTE_LEN);
  assert(len(satoshis) == TX_OUTPUT_SATOSHI_BYTE_LEN);
  return satoshis + int32ToByteString(scriptLen) + script;
}

function mergeInput(txInput: TxIn): ByteString {
  assert(len(txInput.prevTxHash) == TX_INPUT_PREV_TX_HASH_BYTE_LEN);
  assert(len(txInput.sequence) == TX_INPUT_SEQUENCE_BYTE_LEN);
  return (
    txInput.prevTxHash +
    indexValueToBytes(txInput.prevOutputIndexVal) +
    toByteString('00') +
    txInput.sequence
  );
}
