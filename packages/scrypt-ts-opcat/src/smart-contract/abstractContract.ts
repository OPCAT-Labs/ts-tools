import { sha256 } from './fns/hashes.js';
import { IContext } from './types/context.js';
import { ByteString, SHPreimage } from './types/index.js';
import { Int32, PubKey, Sig, OpcatState } from './types/primitives.js';
import { BacktraceInfo } from './types/structs.js';

/**
 * The abstract class for a smart contract.
 * All of the abstract methods of it can be used directly inside a smart contract \@method.
 * @category SmartContract
 */
export abstract class AbstractContract {
  /**
   * Using the [OP_PUSH_TX]{@link https://scryptplatform.medium.com/trustless-ordinal-sales-using-op-cat-enabled-covenants-on-bitcoin-0318052f02b2} technique, check if `shPreimage` is the preimage of the current transaction.
   * @onchain
   * @param shPreimage The format of the preimage
   * @returns true if `shPreimage` is the preimage of the current transaction. Otherwise false.
   */
  abstract checkSHPreimage(shPreimage: SHPreimage): boolean;

  /**
   * A built-in function to create an change output.
   * @onchain
   * @returns the serialized change output byte string or empty byte string if there is no change.
   */
  abstract buildChangeOutput(): ByteString;

  /**
   * A built-in function verifies an ECDSA signature. It takes two inputs from the stack, a public key (on top of the stack) and an ECDSA signature in its DER_CANONISED format concatenated with sighash flags. It outputs true or false on the stack based on whether the signature check passes or fails.
   * @onchain
   * @category Signature Verification
   * @see https://en.bitcoin.it/wiki/OP_CHECKSIG
   */
  abstract checkSig(signature: Sig, publickey: PubKey, errorMsg?: string): boolean;

  /**
   * Implements an absolute time-based lock on a transaction until a specified `locktime` has been reached.
   * The lock can be based on either block height or a UNIX timestamp.
   *
   * If the `locktime` is below 500,000,000, it's interpreted as a block height. Otherwise,
   * it's interpreted as a UNIX timestamp. This function checks and ensures that the transaction's
   * nSequence is less than `UINT_MAX`, and that the provided `locktime` has been reached or passed.
   *
   * @param {bigint} locktime - The block height or timestamp until which the transaction should be locked.
   * @returns If `true` is returned, nlockTime and sequence in `this.ctx` are valid, otherwise they are invalid.
   * @onchain
   * @category Time Lock
   * @see https://docs.scrypt.io/tutorials/timeLock
   */
  abstract absTimeLock(locktime: bigint): boolean;

  /**
   * Implements a relative time-based lock on a transaction until a specified `nSequence` has been reached.
   * The lock can be based on either block height or a UNIX timestamp.
   *
   * @param {bigint} nSequence - The block height or timestamp until which the transaction should be locked.
   * @returns If `true` is returned, nlockTime and sequence in `this.ctx` are valid, otherwise they are invalid.
   * @onchain
   * @category Time Lock
   * @see https://docs.scrypt.io/tutorials/timeLock
   */
  abstract relTimeLock(nSequence: bigint): boolean;

  /**
   * Build the state related outputs.
   * @returns the serialized outputs (state hash root output + other state outputs)
   * @onchain
   * @category State
   *
   */
  abstract buildStateOutput(satoshis: Int32): ByteString;

  /**
   * Check the outputs with the context of current transaction.
   * @param outputs the expected serialized outputs of the current transaction
   * @returns true if the outputs are not consistent with the transaction context, otherwise false.
   * @onchain
   */
  abstract checkOutputs(outputs: ByteString): boolean;

  /**
   * The context of the current spending contract input.
   * It contains the preimage of the current transaction and other context information for the contract input.
   * @onchain
   */
  abstract ctx: IContext;

  /**
   * Calculate the hash of the contract state.
   * @param state the state of the contract
   * @returns the hash byte string of the contract state
   * @onchain
   * @category State
   */
  static serializeState<ST extends OpcatState>(_state: ST): ByteString {
    throw new Error('Not implemented');
  }

  static stateHash<ST extends OpcatState>(_state: ST): ByteString {
    return sha256(this.serializeState(_state));
  }

  /**
   * Check the validity of an input state by verifying its committed state hash.
   * @param inputIndex the index of the input
   * @param rawState the raw/serialized state of the input
   * @returns true if the input state is correct. Otherwise false.
   * @onchain
   * @category State
   */
  abstract checkInputState(inputIndex: Int32, rawState: ByteString): boolean;

  /**
   * Check whether the contract can be traced back to the genesis outpoint.
   * @param backtraceInfo the backtrace info to verify, including prevTx and prevPrevTx informations
   * @param genesisOutpoint expected genesis outpoint to be traced back to
   * @returns true if the contract can be backtraced to the genesis outpoint. Otherwise false.
   * @onchain
   * @category Backtrace
   */
  abstract backtraceToOutpoint(backtraceInfo: BacktraceInfo, genesisOutpoint: ByteString): boolean;

  /**
   * Check whether the contract can be traced back to the genesis script.
   * @param backtraceInfo the backtrace info to verify, including prevTx and prevPrevTx informations
   * @param genesisScript expected genesis script to be traced back to
   * @returns true if the contract can be backtraced to the genesis script. Otherwise false.
   * @onchain
   * @category Backtrace
   */
  abstract backtraceToScript(backtraceInfo: BacktraceInfo, genesisScript: ByteString): boolean;
}
