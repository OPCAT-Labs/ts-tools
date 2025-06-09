import { assert } from '../fns/assert.js';
import {
  TX_INPUT_COUNT_MAX,
  TX_INPUT_PREVOUT_BYTE_LEN,
  TX_OUTPUT_SATOSHI_BYTE_LEN,
  TX_IO_INDEX_VAL_MIN,
  TX_IO_INDEX_VAL_MAX,
  TX_P2TR_OUTPUT_SCRIPT_BYTE_LEN,
  STATE_HASH_ROOT_BYTE_LEN,
  TX_INPUT_PREV_TX_HASH_BYTE_LEN,
  TX_INPUT_SEQUENCE_BYTE_LEN,
} from '../consts.js';
import { prop, method } from '../decorators.js';
import { toByteString, len, int32ToByteString } from '../fns/index.js';
import { OpCode } from '../types/opCode.js';
import { SmartContractLib } from '../smartContractLib.js';
import {
  ByteString,
  Int32,
  SpentScripts,
  SpentAmounts,
  TxOut,
  TxIn,
  Addr,
  XOnlyPubKey,
  Prevouts,
} from '../types/index.js';

type MergePrevoutsResponse = {
  prevouts: ByteString;
  inputCount: Int32;
};

/**
 * Library for parsing and constructing transactions
 * @category Library
 * @onchain
 */
export class TxUtils extends SmartContractLib {
  /** if a output satoshi value is zero */
  @prop()
  static readonly ZERO_SATS: ByteString = toByteString('0000000000000000');

  /** op_return + op_push24 + "cat" (0x636174) + version (0x01) */
  @prop()
  static readonly STATE_HASH_ROOT_SCRIPT_PREFIX: ByteString = toByteString('6a1863617401');

  /**
   * the state hash root value for all non-state inputs,
   * same as hash160(hash160('') + hash160('') + hash160('') + hash160('') + hash160(''))
   */
  @prop()
  static readonly NON_STATES_HASH_ROOT: ByteString = toByteString(
    'f4d5ea814aabc273f329f3563848a090fc8c77cf',
  );

  /**
   * Merge prevout list into a single ByteString
   * @param prevouts prevout list to merge
   * @returns merged prevouts and number of tx inputs
   */
  @method()
  static mergePrevouts(prevouts: Prevouts): MergePrevoutsResponse {
    const mergedPrevouts: ByteString =
      prevouts[0] + prevouts[1] + prevouts[2] + prevouts[3] + prevouts[4] + prevouts[5];

    let inputCount = 0n;

    const prevoutsLen = len(mergedPrevouts);
    if (prevoutsLen == 36n) {
      inputCount = 1n;
    } else if (prevoutsLen == 72n) {
      inputCount = 2n;
    } else if (prevoutsLen == 108n) {
      inputCount = 3n;
    } else if (prevoutsLen == 144n) {
      inputCount = 4n;
    } else if (prevoutsLen == 180n) {
      inputCount = 5n;
    } else if (prevoutsLen == 216n) {
      inputCount = 6n;
    } else {
      assert(false, 'prevouts invalid length');
    }
    // check there are no empty elements between prevouts in the array
    // correct: [prevout, prevout, prevout, empty, empty, empty]
    // invalid: [prevout, prevout, empty, prevout, empty, empty]
    for (let i = 0; i < TX_INPUT_COUNT_MAX; i++) {
      const prevoutLen = len(prevouts[i]);
      if (i < inputCount) {
        assert(prevoutLen == TX_INPUT_PREVOUT_BYTE_LEN, 'invalid prevout list');
      } else {
        assert(prevoutLen == 0n, 'invalid prevout list');
      }
    }
    return { prevouts: mergedPrevouts, inputCount };
  }

  /**
   * Merge spent script list into a single ByteString
   * @param scripts spent script list to merge
   * @param t_inputCount the number of tx inputs, must be verified and trusable
   * @returns merged spent scripts
   */
  @method()
  static mergeSpentScripts(scripts: SpentScripts, t_inputCount: bigint): ByteString {
    for (let i = 0; i < TX_INPUT_COUNT_MAX; i++) {
      const scriptLen = len(scripts[i]);
      if (i < t_inputCount) {
        assert(scriptLen > 0n, 'spent script length must be greater than 0');
      } else {
        assert(scriptLen == 0n, 'invalid spent script list');
      }
    }
    let spentScripts = toByteString('');
    for (let i = 0; i < TX_INPUT_COUNT_MAX; i++) {
      const script = scripts[i];
      spentScripts += int32ToByteString(len(script)) + script;
    }
    return spentScripts;
  }

  /**
   *  Merge spent amount list into a single ByteString
   * @param amounts spent amount list to merge
   * @param t_inputCount the number of tx inputs, must be verified and trusable
   * @returns merged spent amounts
   */
  @method()
  static mergeSpentAmounts(amounts: SpentAmounts, t_inputCount: bigint): ByteString {
    for (let i = 0; i < TX_INPUT_COUNT_MAX; i++) {
      const scriptLen = len(amounts[i]);
      if (i < t_inputCount) {
        assert(scriptLen == TX_OUTPUT_SATOSHI_BYTE_LEN, 'spent amount byte length must be 8');
      } else {
        assert(scriptLen == 0n, 'invalid spent amount list');
      }
    }
    return amounts[0] + amounts[1] + amounts[2] + amounts[3] + amounts[4] + amounts[5];
  }

  /**
   * Convert tx input index or output index from value to bytes
   * @param indexVal value of the input index or output index
   * @returns ByteString of the input index or output index
   */
  @method()
  static indexValueToBytes(indexVal: Int32): ByteString {
    assert(indexVal >= TX_IO_INDEX_VAL_MIN && indexVal <= TX_IO_INDEX_VAL_MAX);
    let indexBytes = int32ToByteString(indexVal);
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
  static buildOutput(script: ByteString, satoshis: ByteString): ByteString {
    const scriptLen = len(script);
    assert(scriptLen > 0 && scriptLen <= TX_P2TR_OUTPUT_SCRIPT_BYTE_LEN);
    assert(len(satoshis) == TX_OUTPUT_SATOSHI_BYTE_LEN);
    return satoshis + int32ToByteString(scriptLen) + script;
  }

  /**
   * Build serialized state hash root output
   * @param hashRoot state hash root
   * @returns serialized state hash root output in format ByteString
   */
  @method()
  static buildStateHashRootOutput(hashRoot: ByteString): ByteString {
    return TxUtils.buildOutput(TxUtils.buildStateHashRootScript(hashRoot), TxUtils.ZERO_SATS);
  }

  /**
   * Build locking script of state output from state hash root
   * @param hashRoot state hash root
   * @returns locking script of state hash root output
   */
  @method()
  static buildStateHashRootScript(hashRoot: ByteString): ByteString {
    assert(len(hashRoot) == STATE_HASH_ROOT_BYTE_LEN);
    return TxUtils.STATE_HASH_ROOT_SCRIPT_PREFIX + hashRoot;
  }

  /**
   * Build serialized change output
   * @param change change output to build
   * @returns serialized change output in format ByteString
   */
  @method()
  static buildChangeOutput(change: TxOut): ByteString {
    return change.satoshis != TxUtils.ZERO_SATS
      ? TxUtils.buildOutput(change.script, change.satoshis)
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
    assert(len(txInput.sequence) == TX_INPUT_SEQUENCE_BYTE_LEN);
    return (
      txInput.prevTxHash +
      TxUtils.indexValueToBytes(txInput.prevOutputIndexVal) +
      toByteString('00') +
      txInput.sequence
    );
  }

  /**
   * build `OP_RETURN` script from data payload
   * @param {ByteString} data the data payload
   * @returns {ByteString} a ByteString contains the data payload
   */
  @method()
  static buildOpReturnOutput(data: ByteString): ByteString {
    const script = toByteString('6a') + int32ToByteString(len(data)) + data;
    return TxUtils.ZERO_SATS + int32ToByteString(len(script)) + script;
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
      int32ToByteString(20n) +
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
  static buildP2PKHOutput(addr: Addr, amount: ByteString): ByteString {
    return TxUtils.buildOutput(TxUtils.buildP2PKHScript(addr), amount);
  }

  @method()
  /**
   * constructs a P2WPKH script from a given PubKeyHash
   * @param {Addr} addr - the recipient's public key hash
   * @returns {ByteString} a `ByteString` representing the P2PKH script
   */
  static buildP2WPKHScript(addr: Addr): ByteString {
    return toByteString(OpCode.OP_0) + int32ToByteString(20n) + addr;
  }

  /**
   * constructs a P2WPKH output from a given PubKeyHash and satoshi amount
   * @param {Addr} addr - the recipient's public key hash
   * @param {ByteString} amount - the satoshi amount
   * @returns {ByteString} a `ByteString` representing the P2PKH output
   */
  @method()
  static buildP2WPKHOutput(addr: Addr, amount: ByteString): ByteString {
    return TxUtils.buildOutput(TxUtils.buildP2WPKHScript(addr), amount);
  }

  @method()
  /**
   * constructs a p2tr script from a given PubKeyHash
   * @param {XOnlyPubKey} xpubkey - the recipient's x-only key
   * @returns {ByteString} a `ByteString` representing the P2PKH script
   */
  static buildP2TRScript(xpubkey: XOnlyPubKey): ByteString {
    return toByteString(OpCode.OP_1) + int32ToByteString(32n) + xpubkey;
  }

  /**
   * constructs a p2tr output from a given PubKeyHash and satoshi amount
   * @param {XOnlyPubKey} xpubkey - the recipient's x-only public key
   * @param {ByteString} amount - the satoshi amount
   * @returns {ByteString} a `ByteString` representing the P2PKH output
   */
  @method()
  static buildP2TROutput(xpubkey: XOnlyPubKey, amount: ByteString): ByteString {
    return TxUtils.buildOutput(TxUtils.buildP2TRScript(xpubkey), amount);
  }

  /**
   * convert a `Int32` number to 8 bytes in little-end order.
   * @param {Int32} n - the satoshi amount
   * @returns {ByteString} a `ByteString`
   */
  @method()
  static toSatoshis(n: Int32): ByteString {
    let int32Bytes = int32ToByteString(n);
    const amountBytesLen = len(int32Bytes);
    assert(amountBytesLen < 8n);
    if (amountBytesLen == 0n) {
      int32Bytes += toByteString('0000000000000000');
    } else if (amountBytesLen == 1n) {
      int32Bytes += toByteString('00000000000000');
    } else if (amountBytesLen == 2n) {
      int32Bytes += toByteString('000000000000');
    } else if (amountBytesLen == 3n) {
      int32Bytes += toByteString('0000000000');
    } else if (amountBytesLen == 4n) {
      int32Bytes += toByteString('00000000');
    } else if (amountBytesLen == 5n) {
      int32Bytes += toByteString('000000');
    } else if (amountBytesLen == 6n) {
      int32Bytes += toByteString('0000');
    } else if (amountBytesLen == 7n) {
      int32Bytes += toByteString('00');
    }
    return int32Bytes;
  }
}
