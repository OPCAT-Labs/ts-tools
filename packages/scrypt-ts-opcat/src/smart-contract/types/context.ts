import { PsbtTxInput, PsbtTxOutput } from '@scrypt-inc/bitcoinjs-lib';
import { StatefulCovenantUtxo } from '../../covenant.js';
import { InputIndex } from '../../globalTypes.js';
import { ByteString, Int32, SigHashType } from './primitives.js';
import {
  SHPreimage,
  SpentScripts,
  SpentAmounts,
  StateHashes,
  InputStateProof,
  Prevouts,
  InputStateProofs,
  Outpoint,
  TxOut,
} from './structs.js';

/**
 * The context of the current contract, can be accessed by `this.ctx` in the contract.
 */
export interface IContext extends SHPreimage, DerivedCtx {
  /**
   * @type {Int32}
   * Index of this input in the transaction input vector. Starts from 0.
   */
  inputIndexVal: Int32;

  /**
   * @type {FixedArray<Outpoint, typeof TX_INPUT_COUNT_MAX>}
   * prevouts is an array of the previous outpoints.
   * each non-empty element is a ByteString of 36 bytes, which is the concatenation of txid and index.
   */
  prevouts: Prevouts;

  /**
   * @type {SpentScripts}
   *
   */
  spentScripts: SpentScripts;

  /**
   * @type {SpentAmounts}
   *
   */
  spentAmounts: SpentAmounts;

  /**
   * @type {StateHashes}
   * The hashes of the next(new) states in the outputs of the current transaction.
   */
  nextStateHashes: StateHashes;

  /**
   * @type {InputStateProofs}
   * The state proofs of the inputs.
   */
  inputStateProofs: InputStateProofs;
}

export type InputContext = ParamCtx & DerivedCtx;

/**
 * The context provided by the parameters of the unlocking script for the current input.
 */
type ParamCtx = {
  inputIndexVal: Int32;
  shPreimage: SHPreimage;
  prevouts: Prevouts;
  spentScripts: SpentScripts;
  spentAmounts: SpentAmounts;
  nextStateHashes: StateHashes;
  inputStateProofs?: InputStateProofs;
};

/**
 * The context derived from other context for the current input.
 *
 */
type DerivedCtx = {
  /**
   * @type {Int32}
   * input count of the current transaction
   */
  inputCount: Int32;

  /**
   * @type {Outpoint}
   * The outpoint of the current input.
   */
  prevout: Outpoint;

  /**
   * @type {ByteString}
   * The locking script of the current input.
   */
  spentScript: ByteString;

  /**
   * @type {ByteString}
   * The amount of the current input.
   */
  spentAmount: ByteString;

  /**
   * @type {InputStateProof}
   * The state proof of the current input.
   */
  inputStateProof: InputStateProof;
};

/**
 * Defined interfaces for obtaining the current transaction context.
 */
export interface Contextual {
  /**
   * Inputs of the current PSBT
   */
  get txInputs(): PsbtTxInput[];

  /**
   * Outputs of the current PSBT
   */
  get txOutputs(): PsbtTxOutput[];

  /**
   * Get the context of the current PSBT input in which this contract is called or spent.
   * @param inputIndex the index of the input in the PSBT
   * @returns the context of the current PSBT input
   */
  getInputCtx(inputIndex: InputIndex): InputContext;

  /**
   * Get the lockTime of the current PSBT.
   * @returns lockTime of the current PSBT input
   */
  getlockTime(): number;

  /**
   * Get the sequence of the input by inputIndex.
   * @param inputIndex the index of the input in the PSBT
   * @returns the sequence of the PSBT input
   */
  getSequence(inputIndex: InputIndex): number;

  /**
   * Set the sighash type for the current input.
   * used for `@method` decorator to set the sighash type for the current input.
   * sighash type is used to generate the preimage for the current input.
   * @param inputIndex the index of the input in the PSBT
   * @param sigHashType the sighash type to set
   */
  setSighashType(inputIndex: number, sigHashType: SigHashType): void;

  /**
   * Get the sighash type for the current input.
   * @param inputIndex the index of the input in the PSBT
   * @returns the sighash type for the current input
   */
  getSigHashType(inputIndex: number): SigHashType;

  /**
   * Get the change output information.
   */
  getChangeInfo(): TxOut;

  /**
   * Whether the PSBT starts finalizing.
   */
  isFinalizing: boolean;

  /**
   * Whether the PSBT is finalized.
   */
  isFinalized: boolean;

  /**
   * Get the output state hashes of the current transaction
   * @returns the output state hashes of the current transaction
   */
  getTxoStateHashes(): StateHashes;

  /**
   * Get the stateful covenant utxo of the current input
   * @param inputIndex the index of the input in the PSBT
   * @returns the stateful covenant utxo of the current input
   */
  getStatefulInputUtxo(inputIndex: InputIndex): StatefulCovenantUtxo | undefined;
}
