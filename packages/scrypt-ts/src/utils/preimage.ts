import * as tools from 'uint8array-tools';
import { ByteString, SHPreimage } from '../smart-contract/types/index.js';
import { byteStringToInt, intToByteString, toByteString } from '../smart-contract/fns/byteString.js';



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
    nVersion: toByteString(tools.toHex(preimage.subarray(0, 4))),
    hashPrevouts: tools.toHex(preimage.subarray(4, 36)),
    spentScriptHash: tools.toHex(preimage.subarray(36, 68)),
    spentDataHash: tools.toHex(preimage.subarray(68, 100)),
    value: byteStringToInt(tools.toHex(preimage.subarray(100, 108))),
    nSequence: toByteString(tools.toHex(preimage.subarray(108, 112))),
    hashSpentAmounts: tools.toHex(preimage.subarray(112, 144)),
    hashSpentScriptHashes: tools.toHex(preimage.subarray(144, 176)),
    hashSpentDataHashes: tools.toHex(preimage.subarray(176, 208)),
    hashSequences: tools.toHex(preimage.subarray(208, 240)),
    hashOutputs: tools.toHex(preimage.subarray(240, 272)),
    inputIndex: byteStringToInt(tools.toHex(preimage.subarray(272, 276))),
    nLockTime: byteStringToInt(tools.toHex(preimage.subarray(276, 280))),
    sigHashType: byteStringToInt(tools.toHex(preimage.subarray(280, 284))),
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
  const rawSHPreimage = shPreimage.nVersion
    + shPreimage.hashPrevouts
    + shPreimage.spentScriptHash
    + shPreimage.spentDataHash
    + intToByteString(shPreimage.value, 8n)
    + shPreimage.nSequence
    + shPreimage.hashSpentAmounts
    + shPreimage.hashSpentScriptHashes
    + shPreimage.hashSpentDataHashes
    + shPreimage.hashSequences
    + shPreimage.hashOutputs
    + intToByteString(shPreimage.inputIndex, 4n)
    + intToByteString(shPreimage.nLockTime, 4n)
    + intToByteString(shPreimage.sigHashType, 4n);

  return rawSHPreimage
}