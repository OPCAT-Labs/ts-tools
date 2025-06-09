import { assert } from '../fns/assert.js';
import { STATE_OUTPUT_COUNT_MAX, STATE_HASH_BYTE_LEN } from '../consts.js';
import { method } from '../decorators.js';
import { toByteString, len } from '../fns/byteString.js';
import { hash160 } from '../fns/hashes.js';
import { SmartContractLib } from '../smartContractLib.js';
import { ByteString, Int32 } from '../types/primitives.js';
import { StateHashes, InputStateProof } from '../types/structs.js';
import { TxProof } from './txProof.js';
import { TxUtils } from './txUtils.js';

/**
 * state utils library
 * @category Library
 * @onchain
 */
export class StateUtils extends SmartContractLib {
  /**
   * Check if stateHashes match hashRoot
   * @param stateHashes state hash array of tx outputs
   * @param t_hashRoot trustable state hash root
   */
  @method()
  static checkStateHashRoot(stateHashes: StateHashes, t_hashRoot: ByteString): void {
    let stateRoots = toByteString('');
    for (let i = 0; i < STATE_OUTPUT_COUNT_MAX; i++) {
      const stateHash = stateHashes[i];
      const stateHashLen = len(stateHash);
      assert(stateHashLen == 0n || stateHashLen == STATE_HASH_BYTE_LEN);
      stateRoots += hash160(stateHash);
    }
    assert(hash160(stateRoots) == t_hashRoot, 'stateHashes and hashRoot mismatch');
  }

  /**
   * Pad empty state roots to fill the state root array
   * @param stateCount the number of states
   * @returns padding state roots
   */
  @method()
  static padEmptyStateRoots(stateCount: Int32): ByteString {
    const emptySlots = BigInt(STATE_OUTPUT_COUNT_MAX) - stateCount;
    assert(emptySlots >= 0n);
    let padding = toByteString('');
    for (let i = 0; i < STATE_OUTPUT_COUNT_MAX; i++) {
      if (i < emptySlots) {
        padding += hash160(toByteString(''));
      }
    }
    return padding;
  }

  /**
   * Build state output with leading state roots, and verify the user pass-in stateHashes as well
   * @param stateHashes user passed-in stateHashes to verify
   * @param t_leadingStateRoots leading state roots of curTx outputs which should be trustable
   * @param t_stateCount the number of states in curTx which should be trustable
   * @returns serialized state output in format ByteString
   */
  @method()
  static buildStateHashRootOutput(
    stateHashes: StateHashes,
    t_leadingStateRoots: ByteString,
    t_stateCount: Int32,
  ): ByteString {
    const hashRoot = hash160(t_leadingStateRoots + StateUtils.padEmptyStateRoots(t_stateCount));
    StateUtils.checkStateHashRoot(stateHashes, hashRoot);
    return TxUtils.buildStateHashRootOutput(hashRoot);
  }

  /**
   * Use trustable hashRoot and outputIndex to check passed-in stateHashes and stateHash
   * @param stateHashes passed-in stateHashes
   * @param stateHash passed-in stateHash
   * @param t_hashRoot trustable hashRoot
   * @param t_outputIndex trustable outputIndex
   */
  @method()
  static checkStateHash(
    stateHashes: StateHashes,
    stateHash: ByteString,
    t_hashRoot: ByteString,
    t_outputIndex: Int32,
  ): void {
    // hashRoot -> stateHashes
    StateUtils.checkStateHashRoot(stateHashes, t_hashRoot);
    // stateHashes + outputIndex -> stateHash
    assert(
      stateHash == stateHashes[Number(t_outputIndex - 1n)],
      'stateHash and stateHashes mismatch',
    );
  }

  /**
   * Check if state of prev output corresponding to an input
   * @param proof input state proof
   * @param stateHash state hash of prev output corresponding to this input
   * @param t_prevout prevout of this input which is trustable
   */
  @method()
  static checkInputStateHash(
    proof: InputStateProof,
    stateHash: ByteString,
    t_prevout: ByteString,
  ): void {
    // prevout -> prevTxPreimage + prevOutputIndexVal
    assert(
      TxProof.getTxHashFromHashRootTxHashPreimage(proof.txHashPreimage) +
        TxUtils.indexValueToBytes(proof.outputIndexVal) ==
        t_prevout,
      `invalid InputStateProof txHashPreimage for input[${proof.outputIndexVal}]`,
    );

    // prevTxPreimage.hashRoot + prevOutputIndexVal -> proof.stateHashes + stateHash
    StateUtils.checkStateHash(
      proof.stateHashes,
      stateHash,
      proof.txHashPreimage.hashRoot,
      proof.outputIndexVal,
    );

    // both proof and stateHash have been verified
  }
}
