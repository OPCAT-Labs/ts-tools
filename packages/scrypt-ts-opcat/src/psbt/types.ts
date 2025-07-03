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
export type ContractCall<Contract> = (
  contract: Contract,
  psbt: IExtPsbt,
  backtraceInfo?: BacktraceInfo,
) => void;

export interface IExtPsbt extends Psbt, Contextual {
  /**
   * Add an input to spend the contract.
   * @param contract the contract
   * @param contractCall the contract call function, such as `(contract: Counter) => { contract.increase() }`, used to determine how to unlock the contract.
   */
  addContractInput<Contract extends SmartContract<OpcatState>>(contract: Contract, contractCall: ContractCall<Contract>): this;

  /**
   * Add an output to create new contract.
   * @param contract a new contract
   * @param satoshis the output includes the amount of satoshis.
   */
  addContractOutput(contract: SmartContract<OpcatState>, satoshis: number): this;

  /**
   * Add a change output to the transaction if neccesarry.
   * @param address the address to send the change to
   * @param feeRate the fee rate in satoshi per byte
   * @param data optional data to be included in the change output
   */
  change(address: string, feeRate: number, data?: Uint8Array): this;

  /**
   * Estimate the size of the transaction.
   */
  estimateSize(): number;

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
