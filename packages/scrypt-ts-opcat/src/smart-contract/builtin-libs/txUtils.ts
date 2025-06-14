import { assert } from '../fns/assert.js';
import {
  TX_INPUT_COUNT_MAX,
  TX_INPUT_PREVOUT_BYTE_LEN,
  TX_OUTPUT_SATOSHI_BYTE_LEN,
  TX_IO_INDEX_VAL_MIN,
  TX_IO_INDEX_VAL_MAX,
  TX_P2TR_OUTPUT_SCRIPT_BYTE_LEN,
  TX_INPUT_PREV_TX_HASH_BYTE_LEN,
  TX_OUTPUT_SCRIPT_HASH_LEN,
  TX_OUTPUT_DATA_HASH_LEN,
  TX_INPUT_SCRIPT_HASH_BYTE_LEN,
  TX_VERSION_BYTE_LEN,
  TX_INPUT_BYTE_LEN,
  TX_OUTPUT_BYTE_LEN,
} from '../consts.js';
import { prop, method } from '../decorators.js';
import { toByteString, len, intToByteString, sha256, hash256 } from '../fns/index.js';
import { OpCode } from '../types/opCode.js';
import { SmartContractLib } from '../smartContractLib.js';
import {
  ByteString,
  Int32,
  TxOut,
  TxIn,
  Addr,
  UInt64,
  TxHashPreimage,
} from '../types/index.js';
import { StdUtils } from './index.js';

/**
 * Library for parsing and constructing transactions
 * @category Library
 * @onchain
 */
export class TxUtils extends SmartContractLib {
  /** if a output satoshi value is zero */
  @prop()
  static readonly ZERO_SATS: ByteString = toByteString('0000000000000000');

  /**
   * Convert tx input index or output index from value to bytes
   * @param indexVal value of the input index or output index
   * @returns ByteString of the input index or output index
   */
  @method()
  static indexValueToBytes(indexVal: Int32): ByteString {
    assert(indexVal >= TX_IO_INDEX_VAL_MIN && indexVal <= TX_IO_INDEX_VAL_MAX);
    let indexBytes = intToByteString(indexVal);
    if (indexBytes == toByteString('')) {
      indexBytes = toByteString('00');
    }
    return indexBytes + toByteString('000000');
  }

  /**
   * Check if the index value and bytes are matched
   * @param indexVal value of the input index or output index
   * @param indexBytes ByteString of the input index or output index
   */
  @method()
  static checkIndex(indexVal: Int32, indexBytes: ByteString): void {
    assert(TxUtils.indexValueToBytes(indexVal) == indexBytes);
  }

  /**
   * Build serialized tx output
   * @param script serialized locking script of the output
   * @param satoshis serialized satoshis of the output
   * @returns serialized tx output in format ByteString
   */
  @method()
  static buildOutput(satoshis: ByteString, scriptHash: ByteString, dataHash: ByteString): ByteString {
    assert(len(scriptHash) == TX_OUTPUT_SCRIPT_HASH_LEN);
    assert(len(dataHash) == TX_OUTPUT_DATA_HASH_LEN);
    assert(len(satoshis) == TX_OUTPUT_SATOSHI_BYTE_LEN);
    return satoshis + scriptHash + dataHash;
  }

  /**
   * Build serialized change output
   * @param change change output to build
   * @returns serialized change output in format ByteString
   */
  @method()
  static buildChangeOutput(change: TxOut): ByteString {
    return change.satoshis > 0n
      ? TxUtils.buildOutput(StdUtils.uint64ToByteString(change.satoshis), change.scriptHash, change.dataHash)
      : toByteString('');
  }

  /**
   * Merge tx input into a ByteString
   * @param txInput tx input, must be a segwit input
   * @returns serialized tx input
   */
  @method()
  static mergeInput(txInput: TxIn): ByteString {
    assert(len(txInput.prevTxHash) == TX_INPUT_PREV_TX_HASH_BYTE_LEN);
    assert(len(txInput.scriptHash) == TX_INPUT_SCRIPT_HASH_BYTE_LEN);
    return (
      txInput.prevTxHash +
      StdUtils.uint32ToByteString(txInput.prevOutputIndex) +
      txInput.scriptHash +
      StdUtils.uint32ToByteString(txInput.sequence)
    );
  }

  @method()
  static getTxHashFromTxHashPreimage(txHashPreimage: TxHashPreimage): ByteString {
    assert(len(txHashPreimage.version) == TX_VERSION_BYTE_LEN);
    StdUtils.checkLenDivisibleBy(txHashPreimage.inputList, TX_INPUT_BYTE_LEN);
    StdUtils.checkLenDivisibleBy(txHashPreimage.outputList, TX_OUTPUT_BYTE_LEN);
    return hash256(txHashPreimage.version + txHashPreimage.inputList + txHashPreimage.outputList + txHashPreimage.nLockTime);
  }

  /**
   * build `OP_RETURN` script from data payload
   * @param {ByteString} data the data payload
   * @returns {ByteString} a ByteString contains the data payload
   */
  @method()
  static buildOpReturnOutput(data: ByteString): ByteString {
    const script = toByteString('6a') + intToByteString(len(data)) + data;
    return TxUtils.ZERO_SATS + sha256(script) + sha256(toByteString(''));
  }

  /**
   * constructs a P2PKH script from a given PubKeyHash
   * @param {PubKeyHash} pubKeyHash - the recipient's public key hash
   * @returns {ByteString} a `ByteString` representing the P2PKH script
   */
  @method()
  static buildP2PKHScript(addr: Addr): ByteString {
    return (
      toByteString(OpCode.OP_DUP) +
      toByteString(OpCode.OP_HASH160) +
      intToByteString(20n) +
      addr +
      toByteString(OpCode.OP_EQUALVERIFY) +
      toByteString(OpCode.OP_CHECKSIG)
    );
  }

  /**
   * constructs a P2PKH output from a given PubKeyHash and satoshi amount
   * @param {Addr} addr - the recipient's public key hash
   * @param {ByteString} amount - the satoshi amount
   * @returns {ByteString} a `ByteString` representing the P2PKH output
   */
  @method()
  static buildP2PKHOutput(amount: ByteString, addr: Addr, dataHash: ByteString): ByteString {
    return TxUtils.buildOutput(amount, sha256(TxUtils.buildP2PKHScript(addr)), dataHash);
  }

  /**
   * convert a `Int32` number to 8 bytes in little-end order.
   * @param {Int32} n - the satoshi amount
   * @returns {ByteString} a `ByteString`
   */
  @method()
  static satoshisToBytes(n: UInt64): ByteString {
    return StdUtils.uint64ToByteString(n);
  }
}
