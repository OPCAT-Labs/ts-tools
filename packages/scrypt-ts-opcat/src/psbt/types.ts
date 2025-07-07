import { Contextual } from '../smart-contract/types/context.js';
import { SmartContract } from '../smart-contract/smartContract.js';
import { InputIndex } from '../globalTypes.js';
import { Signer, ToSignInput } from '../signer.js';
import { OpcatState, Sig } from '../smart-contract/types/primitives.js';
import { Psbt } from './psbt.js';
import { Transaction } from '@opcat-labs/opcat';
import { BacktraceInfo } from '../smart-contract/types/structs.js';

/**
 * Type definition for a contract call function.
 * @template Contract - The contract instance being called.
 * @param contract - The contract instance to interact with.
 * @param psbt - The PSBT (Partially Signed Bitcoin Transaction).
 * @param backtraceInfo - Optional backtrace information for calling B2G contract.
 */
export type ContractCall<Contract> = (
  contract: Contract,
  psbt: IExtPsbt,
  backtraceInfo?: BacktraceInfo,
) => void;

/**
 * Extended PSBT (Partially Signed Bitcoin Transaction) interface with contract handling capabilities.
 * Provides methods to add contract inputs/outputs, manage change, estimate transaction size/fees,
 * and handle signatures. Extends standard Psbt with additional context and contract-specific operations.
 * 
 * Key features:
 * - Contract input/output management
 * - Change address handling
 * - Transaction size and fee estimation
 * - Schnorr signature retrieval
 * - Signing support
 */
/**
 * Extended PSBT (Partially Signed Bitcoin Transaction) interface with additional contract-related functionality.
 * 
 * This interface extends the standard Psbt with methods for:
 * - Adding contract inputs/outputs
 * - Managing change outputs
 * - Estimating transaction size and fees
 * - Handling signatures
 * 
 * It provides a higher-level abstraction for working with smart contracts in Bitcoin transactions.
 */
/**
 * Extended PSBT (Partially Signed Bitcoin Transaction) interface with additional contract-related methods.
 * Provides functionality for adding contract inputs/outputs, estimating fees/sizes, and handling signatures.
 * Inherits from standard Psbt and Contextual interfaces.
 * 
 * Key features:
 * - Contract input/output management
 * - Change output handling
 * - Transaction size and fee estimation
 * - Schnorr signature retrieval
 * - Signing capability
 */
/**
 * Extended PSBT (Partially Signed Bitcoin Transaction) interface with additional contract-related functionality.
 * 
 * This interface extends the standard Psbt with methods for:
 * - Adding contract inputs/outputs
 * - Handling change outputs
 * - Estimating transaction size and fees
 * - Managing signatures
 * 
 * It provides a higher-level abstraction for working with smart contracts in Bitcoin transactions.
 */
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
   * Get signature from signed psbt by inputIndex
   * @param inputIndex index of the input
   * @param options options to find signatures
   * @returns the signature, if no signature found, return a dummy signature.
   */
  getSig(inputIndex: InputIndex, options: Omit<ToSignInput, 'index'>): Sig;

  /**
   * Signs the PSBT with the provided signer and finalizes all inputs.
   * @param signer - The signer instance used to sign the PSBT.
   * @returns A promise that resolves when signing and finalization are complete.
   */
  signAndFinalize(singer: Signer): Promise<void>;
}
