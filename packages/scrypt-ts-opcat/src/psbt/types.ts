import { Psbt, Transaction } from '@scrypt-inc/bitcoinjs-lib';
import { Covenant } from '../covenant.js';
import { Contextual } from '../smart-contract/types/context.js';
import { SmartContract } from '../smart-contract/smartContract.js';
import { InputIndex } from '../globalTypes.js';
import { ToSignInput } from '../signer.js';
import { Sig, StructObject } from '../smart-contract/types/primitives.js';

/**
 * A options used to determine how to unlock the covenant.
 */
export type SubContractCall = {
  /**
   * `Covenant` can contain multiple `SmartContract`. contractAlias specifies the SmartContract to unlock
   * and determines the script path used to spend the taproot locking script.
   */
  contractAlias?: string;
  /**
   * In this callback, execute the contract's `public` method to obtain the witness of unlocking the contract.
   */
  invokeMethod: MethodInvocation;
};
/** @ignore */
export type MethodInvocation = (
  subContract: SmartContract<StructObject | undefined>,
  psbt: IExtPsbt,
) => void;

export interface IExtPsbt extends Psbt, Contextual {
  /**
   * Add an input to spend the covenant.
   * @param covenant
   * @param subContractAlias
   */
  addCovenantInput(covenant: Covenant, subContractAlias?: string): this;

  /**
   * Add an output to create new covenant.
   * @param covenant a new covenant
   * @param satoshis the output includes the amount of satoshis.
   */
  addCovenantOutput(covenant: Covenant, satoshis: number): this;

  /**
   * Populate the witness for the covenant spending input.
   * @param inputIndex index of the input
   * @param covenant the spent covenant
   * @param subContractCall A options used to determine how to unlock the covenant.
   */
  updateCovenantInput(
    inputIndex: number,
    covenant: Covenant,
    subContractCall: SubContractCall,
  ): this;

  /**
   * Add a change output to the transaction if neccesarry.
   * @param address the address to send the change to
   * @param feeRate the fee rate in satoshi per byte
   * @param estimatedVsize the estimated virtual size of the transaction
   */
  change(address: string, feeRate: number, estimatedVsize?: number): this;

  /**
   * Estimate the virtual size of the transaction.
   */
  estimateVSize(): number;

  /**
   * Estimate the fee of the transaction.
   * @param feeRate the fee rate in satoshi per byte
   * @returns the estimated fee in satoshis
   */
  estimateFee(feeRate: number): number;

  /**
   * The unsigned transaction when the PSBT is not finalized.
   * note:
   */
  unsignedTx: Transaction;

  /**
   * Get schnorr signature from signed psbt by inputIndex
   * @param inputIndex index of the input
   * @param options options to find signatures
   * @returns the signature, if no signature found, return a dummy signature.
   */
  getSig(inputIndex: InputIndex, options: Omit<ToSignInput, 'index'>): Sig;
}
