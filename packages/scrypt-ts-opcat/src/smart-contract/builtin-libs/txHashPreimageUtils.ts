import { TxHashPreimage, ByteString } from "../types/index.js";
import { SmartContractLib } from "../smartContractLib.js";
import {method} from '../decorators.js'
import { assert, len, hash256, slice } from "../fns/index.js";
import { TX_VERSION_BYTE_LEN, TX_OUTPUT_BYTE_LEN, TX_INPUT_BYTE_LEN } from "../consts.js";
import { StdUtils } from "./stdUtils.js";


/**
 * Utility class for working with transaction hash preimages in Bitcoin smart contracts.
 * Provides methods to:
 * - Calculate transaction hash from preimage data
 * - Extract individual input/output byte strings from preimage
 */
export class TxHashPreimageUtils extends SmartContractLib {
  @method()
  static getTxHashFromTxHashPreimage(txHashPreimage: TxHashPreimage): ByteString {
    assert(len(txHashPreimage.version) == TX_VERSION_BYTE_LEN);
    const inputCount = StdUtils.checkLenDivisibleBy(txHashPreimage.inputList, TX_INPUT_BYTE_LEN);
    const outputCount = StdUtils.checkLenDivisibleBy(txHashPreimage.outputList, TX_OUTPUT_BYTE_LEN);
    return hash256(
      txHashPreimage.version + 
      StdUtils.writeVarInt(inputCount) + 
      txHashPreimage.inputList + 
      StdUtils.writeVarInt(outputCount) + 
      txHashPreimage.outputList + 
      txHashPreimage.nLockTime);   
  }

  /**
   * Extracts the byte string of a specific input from the transaction hash preimage.
   * @param txHashPreimage The transaction hash preimage containing input data.
   * @param inputIndex The index of the input to extract.
   * @returns The byte string representing the specified input.
   */
  @method()
  static getInputByteString(txHashPreimage: TxHashPreimage, inputIndex: bigint): ByteString {
    return slice(txHashPreimage.inputList, inputIndex * TX_INPUT_BYTE_LEN, (inputIndex + 1n) * TX_INPUT_BYTE_LEN);
  }

  /**
   * Extracts the byte string of a specific output from the transaction hash preimage.
   * @param txHashPreimage The transaction hash preimage containing output list.
   * @param outputIndex The index of the output to extract.
   * @returns The byte string of the specified output.
   */
  @method()
  static getOutputByteString(txHashPreimage: TxHashPreimage, outputIndex: bigint): ByteString {
    return slice(txHashPreimage.outputList, outputIndex * TX_OUTPUT_BYTE_LEN, (outputIndex + 1n) * TX_OUTPUT_BYTE_LEN);
  }
}
