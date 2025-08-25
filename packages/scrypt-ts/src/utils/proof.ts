import { Transaction } from '@opcat-labs/opcat';
import {
  TX_INPUT_BYTE_LEN,
} from '../smart-contract/consts.js';
import { toByteString,  slice, intToByteString } from '../smart-contract/fns/index.js';
import {
  BacktraceInfo,
  ByteString,
  TxHashPreimage,
  TxIn,
} from '../smart-contract/types/index.js';
import { StdUtils } from '../smart-contract/builtin-libs/stdUtils.js';

import { BufferReader } from '../psbt/bufferutils.js';
import { toHex } from 'uint8array-tools';
import { UTXO } from '../globalTypes.js';
import { hexToUint8Array, uint8ArrayToHex } from './common.js';



/**
 * Converts a UTXO to its genesis outpoint format.
 * The genesis outpoint is constructed by reversing the txId bytes and appending
 * the output index as a 4-byte little-endian string.
 * 
 * @param utxo - The UTXO to convert
 * @returns The genesis outpoint as a hex-encoded ByteString
 */
export const toGenesisOutpoint = function (utxo: UTXO): ByteString {
  return uint8ArrayToHex(hexToUint8Array(utxo.txId).reverse()) + intToByteString(BigInt(utxo.outputIndex), 4n);
}

/**
 * convert raw txHash preimage buffer to TxHashPreimage struct
 * @param txHashPreimageBuf
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
