import { Transaction } from '@opcat-labs/opcat';
import {
  TX_INPUT_COUNT_MAX,
  STATE_OUTPUT_COUNT_MAX,
  TX_INPUT_BYTE_LEN,
} from '../smart-contract/consts.js';
import { toByteString, fill, hash160, intToByteString, slice } from '../smart-contract/fns/index.js';
import {
  BacktraceInfo,
  FixedArray,
  TxHashPreimage,
  TxIn,
} from '../smart-contract/types/index.js';
import { StdUtils } from '../smart-contract/builtin-libs/stdUtils.js';
import { uint8ArrayToHex } from './common.js';
import { BufferReader } from '../psbt/bufferutils.js';
import { toHex } from 'uint8array-tools';

export const emptyString = toByteString('');

export const emptyFixedArray = function () {
  return fill(emptyString, TX_INPUT_COUNT_MAX);
};

export const emptyTokenArray = function () {
  return fill(emptyString, STATE_OUTPUT_COUNT_MAX);
};

export const emptyOutputByteStrings = function () {
  return fill(emptyString, STATE_OUTPUT_COUNT_MAX);
};

export const emptyBigIntArray = function () {
  return fill(0n, TX_INPUT_COUNT_MAX);
};

export const emptyTokenAmountArray = function () {
  return fill(0n, STATE_OUTPUT_COUNT_MAX);
};

export const intArrayToByteString = function (
  array: FixedArray<bigint, typeof TX_INPUT_COUNT_MAX>,
) {
  const rList = emptyFixedArray();
  for (let index = 0; index < array.length; index++) {
    const element = array[index];
    rList[index] = hash160(intToByteString(element));
  }
  return rList;
};

/**@ignore */
export const tokenAmountToByteString = function (
  array: FixedArray<bigint, typeof STATE_OUTPUT_COUNT_MAX>,
) {
  const rList = emptyTokenArray();
  for (let index = 0; index < array.length; index++) {
    const element = array[index];
    rList[index] = intToByteString(element);
  }
  return rList;
};

/**
 * convert raw transaction buffer to TxHashPreimage
 * @param txBuf
 * @returns
 */
export const toTxHashPreimage = function (txHashPreimageBuf: Uint8Array): TxHashPreimage {
  const br = new BufferReader(txHashPreimageBuf);

  const version = toHex(br.readSlice(4n))
  const inputCountVal = br.readVarInt();
  let inputList = toByteString('')
  for (let i = 0; i < inputCountVal; i++) {
    inputList += toHex(br.readSlice(36n + 32n + 4n));
  }
  const outputCountVal = br.readVarInt()
  let outputList = toByteString('')
  for (let i = 0; i < outputCountVal; i++) {
    outputList += toHex(br.readSlice(8n + 32n + 32n));
  }
  const nLockTime = toHex(br.readSlice(4n));

  return {
    version,
    inputList,
    outputList,
    nLockTime,
  }
};

/**
 * prevPrevTx: input1 + input2 + ... = output1 + output2 + ...
 * prevTx: input1(prevPrevTx.output1) + input2 + ... = output1 + output2 + ...
 * curTx: input1(prevTx.output1) + input2 + ... = output1 + output2 + ...
 *
 * if we want to backtrace curTx.input1, the arguments should be:
 *
 * @param prevTxHex: prevTx.toHex()
 * @param prevPrevTxHex: prevPrevTx.toHex()
 * @param prevTxInputIndex: prevTx.input1.inputIndex, here is 0
 * @returns
 */
export function getBackTraceInfo (
  prevTxHex: string,
  prevPrevTxHex: string,
  prevTxInputIndex: number,
): BacktraceInfo {

  const prevTx = new Transaction(prevTxHex);
  const prevPrevTx = new Transaction(prevPrevTxHex);

  const prevTxPreimage = toTxHashPreimage(prevTx.toTxHashPreimage());
  const prevPrevTxPreimage = toTxHashPreimage(prevPrevTx.toTxHashPreimage());

  let index = 0n;

  const txInputBytes = slice(prevTxPreimage.inputList, BigInt(prevTxInputIndex) * TX_INPUT_BYTE_LEN, (BigInt(prevTxInputIndex) + 1n) * TX_INPUT_BYTE_LEN)
  const prevTxInput: TxIn = {
    prevTxHash: slice(
      txInputBytes,
      index,
      (index += 32n)
    ),
    prevOutputIndex: StdUtils.fromLEUnsigned(slice(
      txInputBytes,
      index,
      (index += 4n)
    )),
    scriptHash: slice(
      txInputBytes,
      index,
      (index += 32n)
    ),
    sequence: StdUtils.fromLEUnsigned(slice(
      txInputBytes,
      index,
      (index += 4n)
    )),
  }

  return {
    prevTxInput,
    prevTxInputIndex: BigInt(prevTxInputIndex),
    prevPrevTxPreimage,
  }

};
