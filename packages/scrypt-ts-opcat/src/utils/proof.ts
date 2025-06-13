import * as varuint from 'varuint-bitcoin';
import { TxUtils } from '../smart-contract/builtin-libs/txUtils.js';
import {
  TX_INPUT_COUNT_MAX,
  TX_OUTPUT_COUNT_MAX,
  TX_HASH_PREIMAGE2_SUFFIX_ARRAY_SIZE,
  STATE_OUTPUT_COUNT_MAX,
} from '../smart-contract/consts.js';
import { toByteString, fill, hash160, int32ToByteString } from '../smart-contract/fns/index.js';
import {
  FixedArray,
  HashRootTxHashPreimage,
  CompactTxHashPreimage,
  TxIn,
  TxHashPreimage,
} from '../smart-contract/types/index.js';
import { BufferReader, Transaction } from '@scrypt-inc/bitcoinjs-lib';
import { byteStringToBigInt, uint8ArrayToHex } from './common.js';

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
    rList[index] = hash160(int32ToByteString(element));
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
    rList[index] = int32ToByteString(element);
  }
  return rList;
};

/**
 * convert raw transaction buffer to TxHashPreimage
 * @param txBuf
 * @returns
 */
export const toTxHashPreimage = function (txBuf: Uint8Array): TxHashPreimage {
  const headerReader = new BufferReader(txBuf);
  const version = uint8ArrayToHex(headerReader.readSlice(4));
  const inputNumber = headerReader.readVarInt();
  const inputTxhashList = emptyFixedArray();
  const inputOutputIndexList = emptyFixedArray();
  const inputScriptList = emptyFixedArray();
  const inputSequenceList = emptyFixedArray();
  for (let index = 0; index < inputNumber; index++) {
    const txhash = uint8ArrayToHex(headerReader.readSlice(32));
    const outputIndex = uint8ArrayToHex(headerReader.readSlice(4));
    const unlockScript = uint8ArrayToHex(headerReader.readVarSlice());
    if (unlockScript.length > 0) {
      throw Error(`input ${index} unlocking script need eq 0`);
    }
    const sequence = uint8ArrayToHex(headerReader.readSlice(4));
    inputTxhashList[index] = txhash;
    inputOutputIndexList[index] = outputIndex;
    inputScriptList[index] = toByteString('00');
    inputSequenceList[index] = sequence;
  }
  const outputNumber = headerReader.readVarInt();
  const outputSatoshisList = emptyFixedArray();
  const outputScriptLenList = emptyFixedArray();
  const outputScriptList = emptyFixedArray();
  for (let index = 0; index < outputNumber; index++) {
    const satoshiBytes = uint8ArrayToHex(headerReader.readSlice(8));
    const scriptLen = headerReader.readVarInt();
    const script = uint8ArrayToHex(headerReader.readSlice(scriptLen));
    outputSatoshisList[index] = satoshiBytes;
    outputScriptLenList[index] = uint8ArrayToHex(varuint.encode(scriptLen).buffer);
    outputScriptList[index] = script;
  }

  const inputCount = uint8ArrayToHex(varuint.encode(inputNumber).buffer);
  const outputCount = uint8ArrayToHex(varuint.encode(outputNumber).buffer);
  const nLocktime = uint8ArrayToHex(headerReader.readSlice(4));
  return {
    version: version,
    inputCount,
    inputPrevTxHashList: inputTxhashList,
    inputPrevOutputIndexList: inputOutputIndexList,
    inputScriptList: inputScriptList,
    inputSequenceList: inputSequenceList,
    outputCount,
    outputSatoshisList: outputSatoshisList,
    outputScriptLenList: outputScriptLenList,
    outputScriptList: outputScriptList,
    locktime: nLocktime,
  };
};

/**
 * convert a TxHashPreimage to CompactTxHashPreimage
 * @param txHashPreimage
 * @returns
 */
export const toCompactTxHashPreimage = function (
  txHashPreimage: TxHashPreimage,
): CompactTxHashPreimage {
  const inputs = emptyFixedArray();
  for (let index = 0; index < inputs.length; index++) {
    inputs[index] =
      txHashPreimage.inputPrevTxHashList[index] +
      txHashPreimage.inputPrevOutputIndexList[index] +
      txHashPreimage.inputScriptList[index] +
      txHashPreimage.inputSequenceList[index];
  }
  const outputSatoshisList = emptyFixedArray();
  const outputScriptList = emptyFixedArray();
  for (let index = 0; index < outputSatoshisList.length; index++) {
    outputSatoshisList[index] = txHashPreimage.outputSatoshisList[index];
    outputScriptList[index] = txHashPreimage.outputScriptList[index];
  }
  return {
    version: txHashPreimage.version,
    inputCountVal: byteStringToBigInt(txHashPreimage.inputCount),
    inputList: inputs,
    outputCountVal: byteStringToBigInt(txHashPreimage.outputCount),
    outputSatoshisList: outputSatoshisList,
    outputScriptList: outputScriptList,
    locktime: txHashPreimage.locktime,
  };
};

/**
 * convert a TxHashPreimage to HashRootTxHashPreimage
 * @param txHashPreimage
 * @returns
 */
export const toHashRootTxHashPreimage = function (
  txHashPreimg: TxHashPreimage,
): HashRootTxHashPreimage {
  const inputs = emptyFixedArray();
  for (let index = 0; index < inputs.length; index++) {
    // inputs[index] =
    inputs[index] =
      txHashPreimg.inputPrevTxHashList[index] +
      txHashPreimg.inputPrevOutputIndexList[index] +
      txHashPreimg.inputScriptList[index] +
      txHashPreimg.inputSequenceList[index];
  }
  let otherOutputString = toByteString('');
  for (let index = 1; index < TX_OUTPUT_COUNT_MAX; index++) {
    if (txHashPreimg.outputScriptList[index].length > 0) {
      otherOutputString += TxUtils.buildOutput(
        txHashPreimg.outputScriptList[index],
        txHashPreimg.outputSatoshisList[index],
      );
    }
  }
  otherOutputString += txHashPreimg.locktime;
  const suffixList = fill(emptyString, TX_HASH_PREIMAGE2_SUFFIX_ARRAY_SIZE);

  const suffix_0_len = TxUtils.STATE_HASH_ROOT_SCRIPT_PREFIX.length;
  suffixList[0] = otherOutputString.slice(0, suffix_0_len);

  for (let index = 1; index < TX_HASH_PREIMAGE2_SUFFIX_ARRAY_SIZE; index++) {
    const start = suffix_0_len + (index - 1) * 80 * 2;
    const end = start + 80 * 2;
    suffixList[index] = otherOutputString.slice(start, end);
  }

  return {
    version: txHashPreimg.version,
    inputCountVal: byteStringToBigInt(txHashPreimg.inputCount),
    inputList: inputs,
    outputCountVal: byteStringToBigInt(txHashPreimg.outputCount),
    hashRoot: txHashPreimg.outputScriptList[0].slice(12),
    suffixList: suffixList,
  };
};

/** @ignore */
export const createEmptyHashRootTxHashPreimage = function (): HashRootTxHashPreimage {
  return {
    version: emptyString,
    inputCountVal: 0n,
    inputList: fill(emptyString, TX_INPUT_COUNT_MAX),
    outputCountVal: 0n,
    hashRoot: emptyString,
    suffixList: fill(emptyString, TX_HASH_PREIMAGE2_SUFFIX_ARRAY_SIZE),
  };
};


/** @ignore */
export const txHexToHashRootTxHashPreimage = function (txHex: string): HashRootTxHashPreimage {
  const tx = Transaction.fromHex(txHex);
  const txHashPreimg = toTxHashPreimage(tx.toBuffer(undefined, 0, false));
  return toHashRootTxHashPreimage(txHashPreimg);
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
  const prevTxHashPreimage = toTxHashPreimage(
    Transaction.fromHex(prevTxHex).toBuffer(undefined, 0, false),
  );
  const prevPrevTxHashPreimg = toTxHashPreimage(
    Transaction.fromHex(prevPrevTxHex).toBuffer(undefined, 0, false),
  );
  const hashRootTxHashPreimage = toHashRootTxHashPreimage(prevTxHashPreimage);
  const prevPrevCompactTxHashPreimage = toCompactTxHashPreimage(prevPrevTxHashPreimg);
  const prevTxInput: TxIn = {
    prevTxHash: prevTxHashPreimage.inputPrevTxHashList[prevTxInputIndex],
    prevOutputIndexVal: byteStringToBigInt(
      prevTxHashPreimage.inputPrevOutputIndexList[prevTxInputIndex],
    ),
    sequence: prevTxHashPreimage.inputSequenceList[prevTxInputIndex],
  };
  return {
    prevTxPreimage: hashRootTxHashPreimage,
    prevTxInput: prevTxInput,
    prevTxInputIndexVal: BigInt(prevTxInputIndex),
    prevPrevTxPreimage: prevPrevCompactTxHashPreimage,
  };
};
