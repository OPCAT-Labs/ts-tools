import { assert } from '../fns/assert.js';
import {
  TX_VERSION_BYTE_LEN,
  TX_INPUT_COUNT_BYTE_LEN,
  TX_OUTPUT_COUNT_BYTE_LEN,
  TX_INPUT_COUNT_MAX,
  TX_SEGWIT_INPUT_BYTE_LEN,
  TX_OUTPUT_COUNT_MAX,
  TX_LOCKTIME_BYTE_LEN,
} from '../consts.js';
import { method } from '../decorators.js';
import { len, int32ToByteString, toByteString } from '../fns/byteString.js';
import { hash256 } from '../fns/hashes.js';
import { SmartContractLib } from '../smartContractLib.js';
import { ByteString } from '../types/primitives.js';
import { CompactTxHashPreimage, HashRootTxHashPreimage } from '../types/structs.js';
import { TxUtils } from './txUtils.js';

/**
 * Library for computing the transaction hash of preimage.
 * @category Library
 * @onchain
 */
export class TxProof extends SmartContractLib {
  /**
   * Calculate tx hash from CompactTxHashPreimage
   * @param preimage CompactTxHashPreimage
   * @returns tx hash
   */
  @method()
  static getTxHashFromCompactTxHashPreimage(preimage: CompactTxHashPreimage): ByteString {
    // append version, the number of inputs, inputs, and the number of outputs
    assert(len(preimage.version) == TX_VERSION_BYTE_LEN);
    let txRaw =
      preimage.version +
      int32ToByteString(preimage.inputCountVal) +
      preimage.inputList[0] +
      preimage.inputList[1] +
      preimage.inputList[2] +
      preimage.inputList[3] +
      preimage.inputList[4] +
      preimage.inputList[5] +
      int32ToByteString(preimage.outputCountVal);
    let expectedLen = TX_VERSION_BYTE_LEN + TX_INPUT_COUNT_BYTE_LEN + TX_OUTPUT_COUNT_BYTE_LEN;
    for (let i = 0; i < TX_INPUT_COUNT_MAX; i++) {
      // there must be no empty element between inputs in the array
      if (i < preimage.inputCountVal) {
        expectedLen += TX_SEGWIT_INPUT_BYTE_LEN;
        assert(len(preimage.inputList[i]) == TX_SEGWIT_INPUT_BYTE_LEN);
      } else {
        assert(len(preimage.inputList[i]) == 0n);
      }
    }
    assert(len(txRaw) == expectedLen);
    // append outputs
    for (let i = 0; i < TX_OUTPUT_COUNT_MAX; i++) {
      const script = preimage.outputScriptList[i];
      const satoshis = preimage.outputSatoshisList[i];
      if (i < preimage.outputCountVal) {
        txRaw += TxUtils.buildOutput(script, satoshis);
      } else {
        assert(len(script) == 0n);
        assert(len(satoshis) == 0n);
      }
    }
    // append locktime and return the tx hash
    assert(len(preimage.locktime) == TX_LOCKTIME_BYTE_LEN);
    return hash256(txRaw + preimage.locktime);
  }

  /**
   * Calculate tx hash from HashRootTxHashPreimage
   * @param preimage HashRootTxHashPreimage
   * @returns tx hash
   */
  @method()
  static getTxHashFromHashRootTxHashPreimage(preimage: HashRootTxHashPreimage): ByteString {
    // build suffix, including outputs except for the first output, and lock time
    const suffix =
      preimage.suffixList[0] +
      preimage.suffixList[1] +
      preimage.suffixList[2] +
      preimage.suffixList[3];
    // build prefix, including version, the number of inputs, inputs, and the number of outputs
    assert(len(preimage.version) == TX_VERSION_BYTE_LEN);

    const prefix =
      preimage.version +
      int32ToByteString(preimage.inputCountVal) +
      preimage.inputList[0] +
      preimage.inputList[1] +
      preimage.inputList[2] +
      preimage.inputList[3] +
      preimage.inputList[4] +
      preimage.inputList[5] +
      int32ToByteString(preimage.outputCountVal);
    let expectedLen = TX_VERSION_BYTE_LEN + TX_INPUT_COUNT_BYTE_LEN + TX_OUTPUT_COUNT_BYTE_LEN;
    for (let i = 0; i < TX_INPUT_COUNT_MAX; i++) {
      if (i < preimage.inputCountVal) {
        expectedLen += TX_SEGWIT_INPUT_BYTE_LEN;
        assert(len(preimage.inputList[i]) == TX_SEGWIT_INPUT_BYTE_LEN);
      } else {
        assert(len(preimage.inputList[i]) == 0n);
      }
    }
    assert(len(prefix) == expectedLen);
    // build state output

    let stateHashRootOutput = TxUtils.buildStateHashRootOutput(preimage.hashRoot);

    // the first suffix should be the same sizea as the state root hash prefix
    assert(
      len(preimage.suffixList[0]) === len(TxUtils.STATE_HASH_ROOT_SCRIPT_PREFIX),
      `the suffix[0] of the preimage should be the size of ${len(TxUtils.STATE_HASH_ROOT_SCRIPT_PREFIX)} bytes`,
    );

    if (preimage.hashRoot === TxUtils.NON_STATES_HASH_ROOT) {
      // prevent a state tx being used as a non-states tx
      assert(
        preimage.suffixList[0] !== TxUtils.STATE_HASH_ROOT_SCRIPT_PREFIX,
        'the suffix[0] should not be a state root hash prefix for a non-states tx',
      );
      // do not append state hash root output when the it's a non-states tx
      stateHashRootOutput = toByteString('');
    }

    // build raw tx and return the tx hash
    return hash256(prefix + stateHashRootOutput + suffix);
  }
}
