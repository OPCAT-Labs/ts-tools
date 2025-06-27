import { Contextual } from '../smart-contract/types/context.js';
import { SmartContract } from '../smart-contract/smartContract.js';
import { InputIndex } from '../globalTypes.js';
import { Signer, ToSignInput } from '../signer.js';
import { OpcatState, Sig } from '../smart-contract/types/primitives.js';
import { Psbt } from './psbt.js';
import { Transaction } from '@opcat-labs/opcat';
import { BacktraceInfo } from '../smart-contract/types/structs.js';
/**
 * A options used to determine how to unlock the covenant.
 */
export type ContractCall = (
  contract: SmartContract<OpcatState>,
  psbt: IExtPsbt,
  backtraceInfo?: BacktraceInfo,
) => void;

export interface IExtPsbt extends Psbt, Contextual {
  /**
   * Add an input to spend the contract.
   * @param contract
   * @param subContractAlias
   */
  addContractInput<Contract extends SmartContract<OpcatState>>(contract: Contract, contractCall?: ContractCall): this;

  /**
   * Add an output to create new contract.
   * @param covenant a new contract
   * @param satoshis the output includes the amount of satoshis.
   * @param data the data to be included in the output, such as the raw state.
   */
  addContractOutput(contract: SmartContract<OpcatState>, satoshis: number): this;

  /**
   * Populate the call arguments for the contract spending input.
   * @param inputIndex index of the input
   * @param subContractCall A options used to determine how to unlock the covenant.
   */
  updateContractInput(
    inputIndex: number,
    contractCall: ContractCall,
  ): this;

  /**
   * Add a change output to the transaction if neccesarry.
   * @param address the address to send the change to
   * @param feeRate the fee rate in satoshi per byte
   * @param data optional data to be included in the change output
   */
  change(address: string, feeRate: number, data?: Uint8Array): this;

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



  sign(singer: Signer): Promise<void>;
}
