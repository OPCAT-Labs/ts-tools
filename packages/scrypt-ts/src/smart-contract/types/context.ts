import { PsbtTxInput, PsbtTxOutput } from '../../psbt/psbt.js';
import { B2GUTXO, InputIndex } from '../../globalTypes.js';
import { SigHashType, UInt32 } from './primitives.js';
import {
  SHPreimage,
  SpentAmounts,
  Prevouts,
  Outpoint,
  TxOut,
  SpentDataHashes,
  SpentScriptHashes,
} from './structs.js';

/**
 * The context of the current contract, can be accessed by `this.ctx` in the contract.
 */
export interface IContext extends SHPreimage, DerivedCtx {

  /**
   * @type {Prevouts}
   * prevouts is an array of the previous outpoints.
   */
  prevouts: Prevouts;

  /**
   * @type {SpentScripts}
   *
   */
  spentScriptHashes: SpentScriptHashes;

  /**
   * @type {SpentAmounts}
   *
   */
  spentAmounts: SpentAmounts;

  /**
   * @type {SpentDataHashes}
   */
  spentDataHashes: SpentDataHashes;
}

export type InputContext = ParamCtx & DerivedCtx;

/**
 * The context provided by the parameters of the unlocking script for the current input.
 */
type ParamCtx = {
  shPreimage: SHPreimage;
  prevouts: Prevouts;
  spentScriptHashes: SpentScriptHashes;
  spentAmounts: SpentAmounts;
  spentDataHashes: SpentDataHashes;
};

/**
 * The context derived from other context for the current input.
 *
 */
type DerivedCtx = {
  /**
   * @type {UInt32}
   * input count of the current transaction
   */
  inputCount: UInt32;

  /**
   * @type {Outpoint}
   * The outpoint of the current input.
   */
  prevout: Outpoint;
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
  getSpentDataHashes(): SpentDataHashes;

  /**
   * Get the b2g contract utxo of the current input
   * @param inputIndex the index of the input in the PSBT
   * @returns the stateful contract utxo of the current input
   */
  getB2GInputUtxo(inputIndex: InputIndex): B2GUTXO | undefined;
}
