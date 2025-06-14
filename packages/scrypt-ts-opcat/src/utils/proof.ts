import * as varuint from 'varuint-bitcoin';
import { TxUtils } from '../smart-contract/builtin-libs/txUtils.js';
import {
  TX_INPUT_COUNT_MAX,
  TX_OUTPUT_COUNT_MAX,
  TX_HASH_PREIMAGE2_SUFFIX_ARRAY_SIZE,
  STATE_OUTPUT_COUNT_MAX,
} from '../smart-contract/consts.js';
import { toByteString, fill, hash160, intToByteString } from '../smart-contract/fns/index.js';
import {
  FixedArray,
  TxHashPreimage,
} from '../smart-contract/types/index.js';
import { byteStringToBigInt, uint8ArrayToHex } from './common.js';
import { BufferReader } from '../psbt/bufferutils.js';
import { Transaction } from '@opcat-labs/opcat';

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
export const toTxHashPreimage = function (txBuf: Uint8Array): TxHashPreimage {
  return {} as any;
  // const headerReader = new BufferReader(txBuf);
  // const version = uint8ArrayToHex(headerReader.readSlice(4));
  // const inputNumber = headerReader.readVarInt();
  // const inputTxhashList = emptyFixedArray();
  // const inputOutputIndexList = emptyFixedArray();
  // const inputScriptList = emptyFixedArray();
  // const inputSequenceList = emptyFixedArray();
  // for (let index = 0; index < inputNumber; index++) {
  //   const txhash = uint8ArrayToHex(headerReader.readSlice(32));
  //   const outputIndex = uint8ArrayToHex(headerReader.readSlice(4));
  //   const unlockScript = uint8ArrayToHex(headerReader.readVarSlice());
  //   if (unlockScript.length > 0) {
  //     throw Error(`input ${index} unlocking script need eq 0`);
  //   }
  //   const sequence = uint8ArrayToHex(headerReader.readSlice(4));
  //   inputTxhashList[index] = txhash;
  //   inputOutputIndexList[index] = outputIndex;
  //   inputScriptList[index] = toByteString('00');
  //   inputSequenceList[index] = sequence;
  // }
  // const outputNumber = headerReader.readVarInt();
  // const outputSatoshisList = emptyFixedArray();
  // const outputScriptLenList = emptyFixedArray();
  // const outputScriptList = emptyFixedArray();
  // for (let index = 0; index < outputNumber; index++) {
  //   const satoshiBytes = uint8ArrayToHex(headerReader.readSlice(8));
  //   const scriptLen = headerReader.readVarInt();
  //   const script = uint8ArrayToHex(headerReader.readSlice(scriptLen));
  //   outputSatoshisList[index] = satoshiBytes;
  //   outputScriptLenList[index] = uint8ArrayToHex(varuint.encode(scriptLen).buffer);
  //   outputScriptList[index] = script;
  // }

  // const inputCount = uint8ArrayToHex(varuint.encode(inputNumber).buffer);
  // const outputCount = uint8ArrayToHex(varuint.encode(outputNumber).buffer);
  // const nLocktime = uint8ArrayToHex(headerReader.readSlice(4));
  // return {
  //   version: version,
  //   inputCount,
  //   inputPrevTxHashList: inputTxhashList,
  //   inputPrevOutputIndexList: inputOutputIndexList,
  //   inputScriptList: inputScriptList,
  //   inputSequenceList: inputSequenceList,
  //   outputCount,
  //   outputSatoshisList: outputSatoshisList,
  //   outputScriptLenList: outputScriptLenList,
  //   outputScriptList: outputScriptList,
  //   locktime: nLocktime,
  // };
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
export const getBackTraceInfo = function (
  prevTxHex: string,
  prevPrevTxHex: string,
  prevTxInputIndex: number,
) {
  return {} as any
  // const prevTxHashPreimage = toTxHashPreimage(
  //   Transaction.fromHex(prevTxHex).toBuffer(undefined, 0, false),
  // );
  // const prevPrevTxHashPreimg = toTxHashPreimage(
  //   Transaction.fromHex(prevPrevTxHex).toBuffer(undefined, 0, false),
  // );
  // const hashRootTxHashPreimage = toHashRootTxHashPreimage(prevTxHashPreimage);
  // const prevPrevCompactTxHashPreimage = toCompactTxHashPreimage(prevPrevTxHashPreimg);
  // const prevTxInput: TxIn = {
  //   prevTxHash: prevTxHashPreimage.inputPrevTxHashList[prevTxInputIndex],
  //   prevOutputIndexVal: byteStringToBigInt(
  //     prevTxHashPreimage.inputPrevOutputIndexList[prevTxInputIndex],
  //   ),
  //   sequence: prevTxHashPreimage.inputSequenceList[prevTxInputIndex],
  // };
  // return {
  //   prevTxPreimage: hashRootTxHashPreimage,
  //   prevTxInput: prevTxInput,
  //   prevTxInputIndexVal: BigInt(prevTxInputIndex),
  //   prevPrevTxPreimage: prevPrevCompactTxHashPreimage,
  // };
};
