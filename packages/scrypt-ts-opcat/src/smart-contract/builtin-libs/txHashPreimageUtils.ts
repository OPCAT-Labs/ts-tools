import { TxHashPreimage, ByteString } from "../types/index.js";
import { SmartContractLib } from "../smartContractLib.js";
import {method} from '../decorators.js'
import { assert, len, hash256, slice } from "../fns/index.js";
import { TX_VERSION_BYTE_LEN, TX_OUTPUT_BYTE_LEN, TX_INPUT_BYTE_LEN } from "../consts.js";
import { StdUtils } from "./stdUtils.js";


export class TxHashPreimageUtils extends SmartContractLib {
  @method()
  static getTxHashFromTxHashPreimage(txHashPreimage: TxHashPreimage): ByteString {
    assert(len(txHashPreimage.version) == TX_VERSION_BYTE_LEN);
    StdUtils.checkLenDivisibleBy(txHashPreimage.inputList, TX_INPUT_BYTE_LEN);
    StdUtils.checkLenDivisibleBy(txHashPreimage.outputList, TX_OUTPUT_BYTE_LEN);
    return hash256(txHashPreimage.version + txHashPreimage.inputList + txHashPreimage.outputList + txHashPreimage.nLockTime);   
  }

  @method()
  static getInputByteString(txHashPreimage: TxHashPreimage, inputIndex: bigint): ByteString {
    return slice(txHashPreimage.inputList, inputIndex * TX_INPUT_BYTE_LEN, (inputIndex + 1n) * TX_INPUT_BYTE_LEN);
  }

  @method()
  static getOutputByteString(txHashPreimage: TxHashPreimage, outputIndex: bigint): ByteString {
    return slice(txHashPreimage.outputList, outputIndex * TX_OUTPUT_BYTE_LEN, (outputIndex + 1n) * TX_OUTPUT_BYTE_LEN);
  }
}
