import * as tools from 'uint8array-tools';
import { ByteString, SHPreimage } from '../smart-contract/types/index.js';
import { byteStringToInt32, int32ToByteString } from '../smart-contract/fns/byteString.js';
import { reverseBuffer } from '../psbt/bufferutils.js';



/**
 * Decodes a serialized SHPreimage from a Uint8Array.
 * 
 * @param preimage - The serialized preimage data as a Uint8Array
 * @returns The decoded SHPreimage object containing:
 *          - Version number
 *          - Hash of previous outputs
 *          - Spent script hash
 *          - Spent data hash
 *          - Spent amount
 *          - Sequence number
 *          - Hash of spent amounts
 *          - Hash of spent scripts
 *          - Hash of spent datas
 *          - Hash of sequences
 *          - Hash of outputs
 *          - Input index
 *          - Lock time
 *          - Sighash type
 */
export function decodeSHPreimage(preimage: Uint8Array): SHPreimage {
  return {
    nVersion: byteStringToInt32(tools.toHex(preimage.subarray(0, 4))),
    hashPrevouts: tools.toHex(preimage.subarray(4, 36)),
    spentScriptHash: tools.toHex(preimage.subarray(36, 68)),
    spentDataHash: tools.toHex(preimage.subarray(68, 100)),
    spentAmount: byteStringToInt32(tools.toHex(preimage.subarray(100, 108))),
    sequence: byteStringToInt32(tools.toHex(preimage.subarray(108, 112))),
    hashSpentAmounts: tools.toHex(preimage.subarray(112, 144)),
    hashSpentScripts: tools.toHex(preimage.subarray(144, 176)),
    hashSpentDatas: tools.toHex(preimage.subarray(176, 208)),
    hashSequences: tools.toHex(preimage.subarray(208, 240)),
    hashOutputs: tools.toHex(preimage.subarray(240, 272)),
    inputIndex: byteStringToInt32(tools.toHex(preimage.subarray(272, 276))),
    nLockTime: byteStringToInt32(tools.toHex(preimage.subarray(276, 280))),
    sighashType: byteStringToInt32(tools.toHex(preimage.subarray(280, 284))),
  };
}


/**
 * Encodes a SHPreimage object into a ByteString by concatenating its fields.
 * Each field is converted to a ByteString with appropriate formatting.
 * 
 * @param shPreimage - The SHPreimage object containing all required fields
 * @returns The concatenated ByteString representation of the SHPreimage
 */
export function encodeSHPreimage(shPreimage: SHPreimage): ByteString {

  const num2bin = function(n: bigint, size: bigint) {
      return tools.toHex(reverseBuffer(tools.fromHex(int32ToByteString(n, size))))
  }
  const rawSHPreimage = num2bin(shPreimage.nVersion, 4n)
    + shPreimage.hashPrevouts
    + shPreimage.spentScriptHash
    + shPreimage.spentDataHash
    + num2bin(shPreimage.spentAmount, 8n)
    + num2bin(shPreimage.sequence, 4n)
    + shPreimage.hashSpentAmounts
    + shPreimage.hashSpentScripts
    + shPreimage.hashSpentDatas
    + shPreimage.hashSequences
    + shPreimage.hashOutputs
    + num2bin(shPreimage.inputIndex, 4n)
    + num2bin(shPreimage.nLockTime, 4n)
    + num2bin(shPreimage.sighashType, 4n);

  return rawSHPreimage
}