
// import { PsbtInput, Psbt as PsbtBase, OpcatUtxo } from '@opcat-labs/bip174';
import { PsbtInput, Psbt as PsbtBase } from 'bip174';
import { ByteString, Sig, SigHashType, TxOut } from '../smart-contract/types/index.js';
import {
  InputIndex, OutputIndex, SupportedNetwork,
  ExtUtxo,
  B2GUTXO,
  UTXO,
} from '../globalTypes.js';
import { ToSignInput, SignOptions, Signer } from '../signer.js';
import { DUST_LIMIT } from '../smart-contract/consts.js';
import { Script } from '../smart-contract/types/script.js';
import { ContextProvider } from './contextProvider.js';
import {
  hexToUint8Array,
  uint8ArrayToHex,
} from '../utils/common.js';
import { InputContext } from '../smart-contract/types/context.js';
import { IExtPsbt, ContractCall } from './types.js';
import * as tools from 'uint8array-tools';
import { toByteString } from '../smart-contract/fns/byteString.js';
import { hash256, sha256 } from '../smart-contract/fns/index.js';

import { FinalScriptsFunc, isFinalized, Psbt, PsbtOptsOptional, PsbtOutputExtended, TransactionInput } from './psbt.js';
import { fromSupportedNetwork } from '../networks.js';
import { Transaction, PublicKey, Networks, Network, encoding } from '@opcat-labs/opcat';
import { SmartContract } from '../smart-contract/smartContract.js';
import { OpcatState } from '../smart-contract/types/primitives.js';
import { BacktraceInfo, SpentDataHashes } from '../smart-contract/types/structs.js';
import { UtxoProvider } from '../providers/utxoProvider.js';
import { ChainProvider } from '../providers/chainProvider.js';
import { toTxHashPreimage } from '../utils/proof.js';
import { IOpcatUtxo } from './utxoConverter.ts.js';

const { BufferWriter } = encoding;

const P2PKH_SIG_LEN = 0x49; // 73 bytes signature
const P2PKH_PUBKEY_LEN = 0x21; // 33 bytes pubkey
const DUMMY_CHANGE_SATOSHIS = BigInt(2100e16); // use the max value to avoid change.satoshis size getting bigger when sealing

type Finalizer = (
  self: ExtPsbt,
  inputIndex: number, // Which input is it?
  input: PsbtInput, // The PSBT input contents
) => Script;


/**
 * Extended PSBT input interface that combines standard PsbtInput and TransactionInput
 * with additional OP_CAT-specific fields.
 * 
 * @property opcatUtxo - The OP_CAT-specific UTXO data associated with this input
 * @property finalizer - Optional finalizer for this input
 * @property sigRequests - Array of signature requests for this input
 */
export interface PsbtInputExtended extends PsbtInput, TransactionInput {
  opcatUtxo: IOpcatUtxo;
  finalizer?: Finalizer;
  sigRequests?: {
    inputIndex: InputIndex;
    options: Omit<ToSignInput, 'index'>;
  }[];
}

/**
 * Extended PSBT options interface that inherits from PsbtOptsOptional, excluding 'network'.
 * 
 * @remarks
 * The `network` property is optional and used by `spendUTXO()` and `change()` methods.
 * It is recommended to set the `network` when working with opcat Signet to avoid address conversion issues,
 * as opcat Signet uses a different address format.
 */
export interface ExtPsbtOpts extends Omit<PsbtOptsOptional, 'network'> {
  /**
   * network config, used by spendUTXO() and change()
   *
   * if you are create a psbt on opcat-signet, you should set `network` to avoid address convertion issues, because opcat-signet has a different address format.
   *
   * make sure you have set the network if you are working on opcat-signet
   */
  network?: Network | SupportedNetwork;
}


/**
 * Extends the standard Psbt class with additional functionality for OP_CAT transactions.
 * Provides methods for:
 * - Managing contract inputs/outputs
 * - Handling UTXO spending
 * - Calculating transaction fees and sizes
 * - Finalizing and sealing transactions
 * - Backtrace information for contract inputs
 * - Change output management
 * 
 * Supports serialization to/from hex, base64 and buffer formats.
 * Includes network-aware operations and signature handling.
 */
export class ExtPsbt extends Psbt implements IExtPsbt {
  constructor(opts: ExtPsbtOpts = {}, data?: PsbtBase) {
    if (typeof opts.network === 'string') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (opts as any as PsbtOptsOptional).network = fromSupportedNetwork(opts.network as SupportedNetwork);
    }
    super(opts as PsbtOptsOptional, data);
    this._ctxProvider = new ContextProvider(this);
  }


  /**
   * Signs the PSBT with the provided signer and finalizes all inputs.
   * @param signer - The signer instance used to sign the PSBT.
   * @returns A promise that resolves when signing and finalization are complete.
   */
  async signAndFinalize(signer: Signer): Promise<void> {
    const signedPsbtHex = await signer.signPsbt(this.toHex(), this.psbtOptions());
    this.combine(ExtPsbt.fromHex(signedPsbtHex)).finalizeAllInputs();
  }

  /**
   * Gets the sequence number for the specified input index.
   * @param inputIndex - The index of the input in the transaction.
   * @returns The sequence number of the input.
   */
  getSequence(inputIndex: InputIndex): number {
    return this.unsignedTx.inputs[inputIndex].sequenceNumber;
  }
  /**
   * Gets the lock time (nLockTime) value from the unsigned transaction.
   * @returns The lock time value as a number.
   */
  getlockTime(): number {
    return this.unsignedTx.nLockTime;
  }

  /**
   * Creates an ExtPsbt instance from a base64-encoded string.
   * @param data - The base64-encoded PSBT data
   * @param opts - Optional configuration options for the ExtPsbt
   * @returns A new ExtPsbt instance
   */
  static fromBase64(data: string, opts: ExtPsbtOpts = {}): ExtPsbt {
    const buffer = tools.fromBase64(data);
    return this.fromBuffer(buffer, opts);
  }

  /**
   * Creates an ExtPsbt instance from a hex string.
   * @param data - Hex string representation of the PSBT data
   * @param opts - Optional configuration options for the ExtPsbt
   * @returns A new ExtPsbt instance
   */
  static fromHex(data: string, opts: ExtPsbtOpts = {}): ExtPsbt {
    const buffer = tools.fromHex(data);
    return this.fromBuffer(buffer, opts);
  }

  /**
   * Creates an ExtPsbt instance from a buffer containing PSBT data.
   * @param buffer - The buffer containing the PSBT data.
   * @param opts - Optional parameters including network configuration.
   * @returns A new ExtPsbt instance initialized with the PSBT data.
   */
  static fromBuffer(buffer: Uint8Array, opts: ExtPsbtOpts = {}): ExtPsbt {
    if (typeof opts.network === 'string') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (opts as any as PsbtOptsOptional).network = fromSupportedNetwork(opts.network as SupportedNetwork);
    }
    const psbt = Psbt.fromBuffer(buffer, opts as PsbtOptsOptional);
    return new ExtPsbt(opts as PsbtOptsOptional, psbt.data);
  }

  private _ctxProvider: ContextProvider;

  private _sigHashTypes: Map<number, SigHashType> = new Map();

  /**
   * Sets the sighash type for a specific input index.
   * Throws an error if attempting to set a different sighash type for the same input index.
   * @param inputIndex - The index of the input to set the sighash type for.
   * @param sigHashType - The sighash type to set.
   * @throws {Error} If the sighash type differs from the previously set type for the same input index.
   */
  setSighashType(inputIndex: number, sigHashType: SigHashType): void {
    if (this._sigHashTypes.has(inputIndex)) {
      // cannot set another sigHashType for the same inputIndex
      if (this._sigHashTypes.get(inputIndex) !== sigHashType)
        throw new Error(
          'the sigHashType cannot be different with sigHashType at @method(sigHashType)',
        );
    } else {
      this._sigHashTypes.set(inputIndex, sigHashType);
    }
  }

  /**
   * Gets the signature hash type for the specified input index.
   * @param inputIndex - The index of the input to get the signature hash type for.
   * @returns The signature hash type for the specified input index.
   */
  getSigHashType(inputIndex: number): SigHashType {
    return this._sigHashTypes.get(inputIndex) as SigHashType;
  }

  /**
   * Gets the input context for the specified input index.
   * @param inputIndex - The index of the input to retrieve context for
   * @returns The InputContext object associated with the specified input index
   */
  getInputCtx(inputIndex: InputIndex): InputContext {
    return this._ctxProvider.getInputCtx(inputIndex);
  }

  /**
   * Calculates and returns the concatenated SHA-256 hashes of all input OP_CAT UTXO data.
   * Each input's data is hashed individually and the results are concatenated.
   * @returns {SpentDataHashes} The combined hashes of all input data as a ByteString.
   */
  getSpentDataHashes(): SpentDataHashes {

    let spentDataHashes: SpentDataHashes = toByteString('');
    for (let i = 0; i < this.data.inputs.length; i++) {
      const opcatUtxo = this.getInputOutput(i)
      spentDataHashes += sha256(tools.toHex(opcatUtxo.data));
    }

    return spentDataHashes;
  }

  /**
   * Computes the hash of all spent data hashes in the PSBT.
   * Concatenates all non-empty spent data hashes and returns their double SHA-256 hash.
   * @returns {ByteString} The hash256 of all spent data hashes concatenated together.
   */
  get hashSpentDatas(): ByteString {

    const spentDataHashes = this.getSpentDataHashes();

    let spentDataHashesJoin = '';
    for (let i = 0; i < spentDataHashes.length; i++) {
      if (spentDataHashes[i]) {
        spentDataHashesJoin += spentDataHashes[i]
      }
    }
    return hash256(spentDataHashesJoin);
  }


  private _sigRequests: Map<InputIndex, Omit<ToSignInput, 'index'>[]> = new Map();
  private _finalizers: Map<InputIndex, Finalizer> = new Map();

  private _inputContracts: Map<InputIndex, SmartContract<OpcatState>> = new Map();
  private _B2GUtxos: Map<InputIndex, B2GUTXO> = new Map();

  private _B2GInfos: Map<InputIndex, BacktraceInfo> = new Map();

  private _outputContracts: Map<OutputIndex, SmartContract<OpcatState>> = new Map();

  private _inputUnlockScripts: Map<InputIndex, Script> = new Map();

  private _changeOutputIndex: number | null = null;
  private _changeToAddr: string;

  private _changeFeeRate: number;

  /**
   * Adds an extended PSBT input with optional finalizer and signature requests.
   * - Calls parent class's `addInput` method
   * - Validates PSBT isn't sealed
   * - If input has a finalizer, caches the unlock script and sets the finalizer callback
   * - Processes any signature requests for the input
   * @param inputData - Extended PSBT input data containing optional finalizer and sigRequests
   * @returns PSBT instance for chaining
   */
  override addInput(inputData: PsbtInputExtended): this {
    super.addInput(inputData);
    this._checkSealed("can't add more input");
    if (inputData.finalizer) {
      const index = this.data.inputs.length - 1;
      const input = this.data.inputs[index];
      const us = inputData.finalizer(this, index, input);
      this._cacheInputUnlockScript(index, us);
      const finalizer = inputData.finalizer;
      this._setInputFinalizer(index, (self, idx, inp) => {
        return finalizer(self, idx, inp);
      });
    }
    if (inputData.sigRequests) {
      for (const sigRequest of inputData.sigRequests) {
        this._addSigRequest(sigRequest.inputIndex, sigRequest.options);
      }
    }

    return this;
  }

  /**
   * Add input(s) for current psbt to spend the utxos.
   * @param utxos the utxos to spend
   * @returns this
   */
  spendUTXO(utxos: ExtUtxo[] | ExtUtxo): this {
    if (!Array.isArray(utxos)) {
      utxos = [utxos];
    }
    for (let i = 0; i < utxos.length; i++) {
      const utxo = utxos[i];
      // verify network match
      const sigAddress = Script.fromHex(utxo.script).toAddress(this.network);
      if (utxo.address && sigAddress.toString() !== utxo.address) {
        throw new Error('The address of the utxo does not match the network of the psbt');
      }
      this.addInput({
        hash: utxo.txId,
        index: utxo.outputIndex,
        opcatUtxo: {
          data: hexToUint8Array(utxo.data),
          script: hexToUint8Array(utxo.script),
          value: BigInt(utxo.satoshis),
        },
        sigRequests: [
          {
            inputIndex: this.txInputs.length,
            options: {
              address: sigAddress.toString(),
            },
          },
        ],
      });

      if (utxo.txHashPreimage) {
        const inputIndex = this.data.inputs.length - 1;
        this._B2GUtxos.set(inputIndex, utxo as B2GUTXO);
      }
    }
    return this;
  }

  /**
   * Adds an extended output to the PSBT.
   * @param outputData - The extended output data to add
   * @returns The PSBT instance for chaining
   * @throws Error if the PSBT is already sealed
   */
  override addOutput(outputData: PsbtOutputExtended): this {
    super.addOutput(outputData);
    this._checkSealed("can't add more output");
    return this;
  }

  /**
   * Sets the version number of the PSBT.
   * @param version - The version number to set.
   * @returns The PSBT instance for chaining.
   * @throws Error if the PSBT is sealed.
   */
  override setVersion(version: number): this {
    this._checkSealed("can't setVersion");
    return super.setVersion(version);
  }

  /**
   * Sets the locktime for the PSBT (Partially Signed Opcat Transaction).
   * @param locktime - The locktime value to set (in blocks or timestamp)
   * @returns The PSBT instance for chaining
   * @throws Error if the PSBT is already sealed
   */
  override setLocktime(locktime: number): this {
    this._checkSealed("can't setLocktime");
    return super.setLocktime(locktime);
  }

  /**
   * Sets the sequence number for the specified input.
   * @param inputIndex - The index of the input to modify
   * @param sequence - The sequence number to set
   * @returns The PSBT instance for method chaining
   * @throws If the PSBT is sealed (immutable)
   */
  override setInputSequence(inputIndex: number, sequence: number): this {
    this._checkSealed("can't setInputSequence");
    return super.setInputSequence(inputIndex, sequence);
  }

  /**
   * Adds a contract input to the PSBT (Partially Signed Bitcoin Transaction).
   * 
   * @param contract - The smart contract instance to add as input.
   * @param contractCall - The contract call containing the method and arguments.
   * @returns The PSBT instance for method chaining.
   * @throws Error if the contract does not have a bound UTXO.
   */
  addContractInput<Contract extends SmartContract<OpcatState>>(
    contract: Contract,
    contractCall: ContractCall<Contract>,
  ): this {
    const fromUtxo = contract.utxo;
    if (!fromUtxo) {
      throw new Error(
        `The contract input '${contract.constructor.name}' does not bind to any UTXO`,
      );
    }

    this.addInput({
      hash: fromUtxo.txId,
      index: fromUtxo.outputIndex,
      opcatUtxo: {
        script: hexToUint8Array(fromUtxo.script),
        data: hexToUint8Array(fromUtxo.data),
        value: BigInt(fromUtxo.satoshis),
      },
    });

    const inputIndex = this.data.inputs.length - 1;
    this._inputContracts.set(inputIndex, contract);
    if ("txHashPreimage" in fromUtxo) {
      this._B2GUtxos.set(inputIndex, contract.utxo as B2GUTXO);
    }

    if (contractCall) {
      this.updateContractInput(inputIndex, contractCall);
    }

    return this;
  }

  /**
   * Removes an input from the PSBT at the specified index.
   * This updates the unsigned transaction, input data, and clears related contract,
   * UTXO, finalizer, and signature request mappings for the removed input.
   * @param inputIndex - The index of the input to remove
   * @returns The PSBT instance for method chaining
   */
  removeInput(inputIndex: number): this {
    this.unsignedTx.inputs.splice(inputIndex, 1);
    this.data.inputs.splice(inputIndex, 1);
    this._inputContracts.delete(inputIndex);
    this._B2GUtxos.delete(inputIndex);
    this._finalizers.delete(inputIndex);
    this._sigRequests.delete(inputIndex);
    return this;
  }

  /**
   * Removes the last input from the PSBT.
   * @throws {Error} If there are no inputs to remove.
   * @returns {this} The modified PSBT instance for chaining.
   */
  removeLastInput(): this {
    const inputIndex = this.data.inputs.length - 1;
    if (inputIndex < 0) {
      throw new Error('No input to remove');
    }
    this.removeInput(inputIndex);
    return this;
  }

  /**
   * Updates a contract input with the provided contract call and sets up a finalizer.
   * Equivalent to setting the unlock of contract input.
   * @param inputIndex - The index of the input to update.
   * @param contractCall - The contract call to be executed during finalization.
   * @returns The current instance for method chaining.
   * @throws {Error} If no contract is found for the specified input index.
   */
  private updateContractInput<Contract extends SmartContract<OpcatState>>(
    inputIndex: number,
    contractCall: ContractCall<Contract>,
  ): this {

    const contract = this._inputContracts.get(inputIndex);
    if (!contract) {
      throw new Error(`No contract found for input index ${inputIndex}`);
    }


    // update the contract binding to the current psbt input
    contract.spentFromInput(this, inputIndex);

    const finalizer: Finalizer = (
      _self: ExtPsbt,
      _inputIndex: number, // Which input is it?
      _input: PsbtInput, // The PSBT input contents
    ) => {
      const backtraceInfo = this._B2GInfos.get(inputIndex);
      contractCall(contract as Contract, this, backtraceInfo);
      return contract.getUnlockingScript();
    };
    this._setInputFinalizer(inputIndex, finalizer);

    return this;
  }

  /**
   * Adds a contract output to the PSBT (Partially Signed Opcat Transaction).
   * 
   * @param contract - The smart contract instance to add as output
   * @param satoshis - The amount in satoshis to lock in this output
   * @returns The PSBT instance for method chaining
   * @template Contract - Type parameter extending `SmartContract<OpcatState>`
   */
  addContractOutput<Contract extends SmartContract<OpcatState>>(contract: Contract, satoshis: number): this {


    const Contract = Object.getPrototypeOf(contract).constructor as typeof SmartContract;

    this.addOutput({
      script: contract.lockingScript.toBuffer(),
      value: BigInt(satoshis),
      data: contract.getStateType() !== undefined ? tools.fromHex(Contract.serializeState(contract.state)) : new Uint8Array(0),
    });

    const outputIndex = this.txOutputs.length - 1;

    this._outputContracts.set(outputIndex, contract);

    return this;
  }

  /**
   * Gets the total input amount in satoshis as a bigint.
   * @returns The sum of all input values in the PSBT.
   */
  get inputAmount(): bigint {
  // should use bigint here, because the input amount is too large
    // 2100e16 + 1 = 21000000000000000000
    // BigInt(2100e16) + 1n = 21000000000000000001n
    return this.data.inputs.reduce((total, _input, inputIndex) => total + this.getInputOutput(inputIndex).value, 0n);
  }

  /**
   * Gets the total output amount of the PSBT transaction by summing up all output values.
   * @returns The sum of all output values as a bigint.
   */
  get outputAmount(): bigint {
    return this.txOutputs.reduce((total, output) => total + output.value, 0n);
  }


  /**
   * Adds or updates a change output to the PSBT.
   * @param toAddr - The address to receive the change.
   * @param feeRate - The fee rate to use for the change output.
   * @param data - Optional data to include in the output (hex string or Uint8Array).
   * @returns The PSBT instance for chaining.
   */
  change(toAddr: string, feeRate: number, data?: Uint8Array | string): this {
    const changeScript = Script.fromAddress(toAddr);
    if (typeof data === 'string') {
      data = hexToUint8Array(data);
    }
    data = data || new Uint8Array(0)
    if (this._changeOutputIndex === null) {
      super.addOutput({
        script: changeScript.toBuffer(),
        value: DUMMY_CHANGE_SATOSHIS,
        data: data,
      });

      const index = this.txOutputs.length - 1;
      this._changeOutputIndex = index;
    }
    this._changeToAddr = toAddr;
    this._changeFeeRate = feeRate;
    return this;
  }

  private finalizeChangeOutput(): this {
    if (this._changeOutputIndex === null) {
      return this;
    }

    const estVSize = this.estimateSize(); // NOTE: this may be inaccurate due to the unknown call args size

    const changeAmount = this.inputAmount - (this.outputAmount - DUMMY_CHANGE_SATOSHIS) - BigInt(Math.ceil(estVSize * this._changeFeeRate));

    if (changeAmount < 0) {
      throw new Error('Insufficient input satoshis!');
    }

    if (changeAmount >= DUST_LIMIT) {
      const outputs = this.unsignedTx.outputs;
      outputs[this._changeOutputIndex].satoshis = Number(changeAmount);
    } else {
      this.txOutputs.splice(this._changeOutputIndex, 1);
      this._changeOutputIndex = null;
    }

    return this;
  }

  /**
   * Gets the change output information from the PSBT transaction.
   * @returns {TxOut} An object containing the script hash, satoshis value, and data hash of the change output.
   * If no change output exists, returns an empty TxOut with default values (empty script/data hash and 0 satoshis).
   * @throws {Error} If the change output index is set but the output is not found at that index.
   */
  getChangeInfo(): TxOut {
    if (this._changeOutputIndex !== null) {
      const changeOutput = this.txOutputs[this._changeOutputIndex];
      if (!changeOutput) {
        throw new Error(`Change output is not found at index ${this._changeOutputIndex}`);
      }
      return {
        scriptHash: sha256(tools.toHex(changeOutput.script)),
        satoshis: changeOutput.value,
        dataHash: sha256(tools.toHex(changeOutput.data)),
      };
    } else {
      return {
        scriptHash: sha256(toByteString('')),
        satoshis: 0n,
        dataHash: sha256(toByteString('')),
      };
    }
  }

  /**
   * Gets the unsigned transaction from the PSBT's internal cache.
   * @returns The raw unsigned transaction object.
   */
  get unsignedTx(): Transaction {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const c = (this as any).__CACHE;
    return c.__TX;
  }

  /**
   * Gets the network associated with this PSBT instance.
   * @private
   * @returns {Network} The network object (defaults to livenet if not specified in options).
   * @remarks This is intentionally kept private to avoid confusion between network strings passed to constructor and the Network object returned here.
   */
  private get network(): Network {
  // make this get function private to avoid user to call it privately
    // it makes confuse if user pass in a network string to the constructor, but here returns a network object
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (this as any).opts.network || Networks.livenet;
  }

  /**
   * Estimates the total size of the PSBT by summing the unsigned transaction size
   * and the size of unfinalized call arguments.
   * @returns The estimated size in bytes.
   */
  estimateSize(): number {
    return this.unsignedTx.getEstimateSize() + this._unfinalizedCallArgsSize();
  }

  /**
   * Estimates the transaction fee by multiplying the estimated size (in vbytes) by the given fee rate.
   * @param feeRate - Fee rate in satoshis per virtual byte (sat/vbyte).
   * @returns The estimated fee amount in satoshis.
   */
  estimateFee(feeRate: number): number {
    return this.estimateSize() * feeRate;
  }

  private _setInputFinalizer(inputIndex: InputIndex, finalizer: Finalizer): this {
    this._finalizers.set(inputIndex, finalizer);
    return this;
  }

  private _finalizing = false;

  private _isSealed = false;

  /**
   * Indicates whether the PSBT is currently in the process of being finalized.
   * @returns {boolean} True if the PSBT is being finalized, false otherwise.
   */
  get isFinalizing(): boolean {
    return this._finalizing;
  }

  /**
   * Indicates whether the PSBT (Partially Signed Bitcoin Transaction) is sealed.
   * A sealed PSBT cannot be modified further.
   */
  get isSealed(): boolean {
    return this._isSealed;
  }

  /**
   * Finalizes all inputs in the PSBT by applying their respective finalizers.
   * For each input, if a finalizer is present, it generates the unlocking script
   * and creates a finalization function. After finalizing all inputs, it binds
   * the contract UTXOs. Throws an error if any input fails to finalize.
   * 
   * @returns The current PSBT instance for chaining.
   */
  override finalizeAllInputs(): this {
    this._finalizing = true;
    this.data.inputs.forEach((input, idx) => {
      let finalFunc: FinalScriptsFunc | undefined = undefined;
      const finalizer = this._finalizers.get(idx);
      if (finalizer) {
        try {
          const unlockingScript = finalizer(this, idx, input);
          finalFunc = (
            _inputIdx: number,
            _input: PsbtInput,
            _script: Uint8Array, // The "meaningful" locking script Buffer
          ) => {
            return {
              finalScriptSig: unlockingScript.toBuffer(),
            };
          };
        } catch (error) {
          throw new Error(`Failed to finalize input ${idx}: ${error.message}, ${error.stack}`);
        }
      }
      this.finalizeInput(idx, finalFunc);
    });

    this._bindcontractsUtxo();

    return this;
  }

  private _bindcontractsUtxo() {
    const signedTx = this.extractTransaction();
    this._outputContracts.forEach((contract, outputIndex) => {
      const utxo = this.txOutputs[outputIndex];
      contract.bindToUtxo({
        txId: signedTx.id,
        outputIndex,
        data: uint8ArrayToHex(utxo.data),
        satoshis: Number(utxo.value),
        txHashPreimage: uint8ArrayToHex(signedTx.toTxHashPreimage()),
      });
    });
  }

  /**
   * Checks if all inputs in the PSBT are finalized.
   * @returns {boolean} True if all inputs are finalized, false otherwise.
   */
  get isFinalized(): boolean {
    return this.data.inputs.reduce((finalized, input) => {
      return finalized && isFinalized(input);
    }, true);
  }

  private _cacheInputUnlockScript(inputIndex: InputIndex, unlockScript: Script) {
    this._inputUnlockScripts.set(inputIndex, unlockScript);
  }

  private _hasInputUnlockScript(inputIndex: InputIndex) {
    return this._inputUnlockScripts.has(inputIndex);
  }

  private _getInputUnlockScript(inputIndex: InputIndex) {
    return this._inputUnlockScripts.get(inputIndex);
  }

  /**
   * Checks if the input at the specified index is a contract input.
   * @param inputIndex - The index of the input to check.
   * @returns True if the input is a contract input, false otherwise.
   */
  isContractInput(inputIndex: InputIndex): boolean {
    return this._inputContracts.has(inputIndex);
  }

  private _unfinalizedCallArgsSize(): number {
    let size = 0
    this.data.inputs.forEach((input, _inputIndex) => {
      if (!this.isContractInput(_inputIndex)) {
        // p2pkh
        size += P2PKH_SIG_LEN + P2PKH_PUBKEY_LEN + new BufferWriter().writeVarintNum(P2PKH_SIG_LEN + P2PKH_PUBKEY_LEN).toBuffer().length;
      } else {
        if (!isFinalized(input)) {
          if (this._hasInputUnlockScript(_inputIndex)) {
            const scriptBuffer = this._getInputUnlockScript(_inputIndex)!.toBuffer();
            size += new BufferWriter().writeVarintNum(scriptBuffer.length).write(scriptBuffer).toBuffer().length;
          } else {
            // if no unknownKeyVals, we assume the input is not finalized yet
            // and we should not count the size of finalScriptSig
            // because they are not set yet
            size += 0;
          }
        } else {
          if (input.finalScriptSig) {
            size += new BufferWriter().writeVarintNum(input.finalScriptSig.length).write(Buffer.from(input.finalScriptSig)).toBuffer().length;
          } else {
            throw new Error(
              'The input should be finalized with either finalScriptSig',
            );
          }
        }
      }
    });
    return size;
  }

  private _checkSealed(extraMsg: string) {
    if (this._isSealed) {
      throw new Error(`This ExtPsbt has already sealed, ${extraMsg}`);
    }
  }

  private _addSigRequest(inputIndex: InputIndex, options: Omit<ToSignInput, 'index'>) {
    const sigRequests = this._sigRequests.get(inputIndex) || [];
    sigRequests.push(options);
    this._sigRequests.set(inputIndex, sigRequests);
  }

  /**
   * Generates PSBT signing options based on signature requests.
   * 
   * @param autoFinalized - Whether to automatically finalize the PSBT after signing (default: false)
   * @returns SignOptions object containing signing inputs, or undefined if no signatures are required
   */
  psbtOptions(autoFinalized = false): SignOptions | undefined {
    const toSignInputs: ToSignInput[] = [];
    this._sigRequests.forEach((sigReqs, index) => {
      sigReqs.forEach((sigReq) => {
        toSignInputs.push({
          index,
          ...sigReq,
        });
      });
    });
    return toSignInputs.length === 0
      ? undefined
      : {
        autoFinalized,
        toSignInputs,
      };
  }

  /**
   * Retrieves a signature for a specific input in the PSBT.
   * 
   * @param inputIndex - The index of the input to sign.
   * @param options - Signing options including address or public key.
   * @returns The signature as a `Sig` object. If no signature is found, returns a default zero-filled signature.
   * @throws May throw if the input index is invalid or if there are issues with public key conversion.
   */
  getSig(inputIndex: InputIndex, options: Omit<ToSignInput, 'index'>): Sig {
    const input = this.data.inputs[inputIndex];
    let signature: Uint8Array = Uint8Array.from(new Array(P2PKH_SIG_LEN).fill(0));
    this._addSigRequest(inputIndex, options);

    if (input.partialSig) {
      const pSig = input.partialSig.find((partialSig) => {
        const sigAddr = PublicKey.fromHex(tools.toHex(partialSig.pubkey)).toAddress(this.network).toString();
        const reqAddr = options.address || (options.publicKey ? PublicKey.fromHex(options.publicKey).toAddress(this.network).toString() : undefined)
        return (reqAddr === undefined || sigAddr === reqAddr)
      })
      if (pSig) {
        signature = pSig.signature
      }
    }

    return Sig(tools.toHex(signature));
  }

  /**
   * Gets the smart contract associated with a specific input index.
   * 
   * @param inputIndex - The index of the input to retrieve the contract for
   * @returns The smart contract for the specified input, or undefined if not found
   */
  getInputContract(inputIndex: number): SmartContract<OpcatState> | undefined {
    return this._inputContracts.get(inputIndex);
  }

  /**
   * Retrieves the B2G UTXO (Unspent Transaction Output) for a specific input index.
   * @param inputIndex - The index of the input to retrieve the UTXO for.
   * @returns The B2G UTXO if found, otherwise undefined.
   */
  getB2GInputUtxo(inputIndex: number): B2GUTXO | undefined {
    return this._B2GUtxos.get(inputIndex);
  }

  /**
   * Gets the change UTXO (Unspent Transaction Output) if it exists.
   * @returns The change UTXO if found, otherwise null.
   * @throws {Error} If the change output index is defined but no output is found at that index.
   */
  getChangeUTXO(): UTXO | null {
    if (this._changeOutputIndex !== undefined) {
      const changeOutput = this.txOutputs[this._changeOutputIndex];
      if (!changeOutput) {
        throw new Error(`Change output is not found at index ${this._changeOutputIndex}`);
      }
      return this.getUtxo(this._changeOutputIndex);
    } else {
      return null;
    }
  }

  /**
   * Retrieves the UTXO (Unspent Transaction Output) at the specified output index.
   * 
   * @param outputIndex - The index of the output to retrieve
   * @returns An ExtUtxo object containing the UTXO details
   * @throws Error if the output at the specified index is not found
   */
  getUtxo(outputIndex: number): ExtUtxo {
    if (!this.txOutputs[outputIndex]) {
      throw new Error(`Output at index ${outputIndex} is not found`);
    }

    let address: string;
    try {
      // nonstandard script cannot derive address
      address = Script.fromBuffer(Buffer.from(this.txOutputs[outputIndex].script)).toAddress(this.network).toString();
    } catch (error) {
      address = '';
    }

    return {
      txId: this.extractTransaction().id,
      outputIndex: outputIndex,
      script: uint8ArrayToHex(this.txOutputs[outputIndex].script),
      data: uint8ArrayToHex(this.txOutputs[outputIndex].data),
      address: address,
      satoshis: Number(this.txOutputs[outputIndex].value),
      txHashPreimage: this.txHashPreimage(),
    };
  }

  /**
   * Retrieves backtrace information for a PSBT input by fetching and analyzing previous transactions.
   * 
   * @param provider - Provider interface for fetching UTXO and chain data
   * @param inputIndex - Index of the input to trace back from
   * @param prevPrevTxFinder - Async function to locate the transaction before the previous transaction
   * @returns Promise resolving to backtrace information including:
   *          - Previous transaction input details
   *          - Input index in current transaction
   *          - Preimage of the transaction before previous transaction
   */
  async getBacktraceInfo(provider: UtxoProvider & ChainProvider, inputIndex: InputIndex, prevPrevTxFinder: (prevTx: Transaction, provider: UtxoProvider & ChainProvider, inputIndex: InputIndex) => Promise<string>): Promise<BacktraceInfo> {
    const input = this.txInputs[inputIndex];
    const prevTxId = uint8ArrayToHex(Uint8Array.prototype.slice.call(input.hash).reverse());
    const prevTxHex = await provider.getRawTransaction(prevTxId);

    const prevTx = Transaction.fromString(prevTxHex);
    const prevPrevTxHex = await prevPrevTxFinder(prevTx, provider, inputIndex);
    const prevPrevTx = Transaction.fromString(prevPrevTxHex);
    const prevPrevTxId = uint8ArrayToHex(Uint8Array.prototype.slice.call(prevTx.inputs[input.index].prevTxId).reverse());
    return {
      prevTxInput: {
        prevTxHash: prevPrevTxId,
        prevOutputIndex: BigInt(prevTx.inputs[input.index].outputIndex),
        sequence: BigInt(input.sequence),
        scriptHash: sha256(prevTx.inputs[input.index].script.toHex()),
      },
      prevTxInputIndex: BigInt(inputIndex),
      prevPrevTxPreimage: toTxHashPreimage(prevPrevTx.toTxHashPreimage()),
    }
  }

  /**
   * Calculates backtrace information for contract inputs in the PSBT.
   * 
   * Iterates through all inputs and collects backtrace info for contract inputs.
   * Uses the provided provider to fetch previous transaction data when needed.
   * 
   * @param provider - Provider interface for fetching UTXO and chain data
   * @param prevPrevTxFinder - Optional function to find previous transactions
   * @returns Promise that resolves when all backtrace info is calculated
   */
  async calculateBacktraceInfo(provider: UtxoProvider & ChainProvider, prevPrevTxFinder?: (prevTx: Transaction, provider: UtxoProvider & ChainProvider, inputIndex: InputIndex) => Promise<string>): Promise<void> {
    for (let i = 0; i < this.txInputs.length; i++) {
      if (this.isContractInput(i)) {
        const info = await this.getBacktraceInfo(provider, i, prevPrevTxFinder || (async (prevTx: Transaction, provider: UtxoProvider & ChainProvider, _inputIndex: InputIndex) => {
          const prevTxId = uint8ArrayToHex(prevTx.inputs[0].prevTxId);
          const prevTxHex = await provider.getRawTransaction(prevTxId);
          return prevTxHex;
        }));
        this._B2GInfos.set(i, info);
      }
    }
  }

  /**
   * Checks if a given UTXO is a B2G (Back to Genesis) UTXO.
   * A B2G UTXO is identified by the presence of a 'txHashPreimage' property in the object.
   * 
   * @param utxo - The UTXO object to check
   * @returns boolean indicating if the UTXO is a B2G UTXO
   */
  isB2GUtxo(utxo: object): boolean {
    return (
      typeof utxo === 'object' &&
      utxo !== null &&
      'txHashPreimage' in utxo
    );
  }

  /**
   * Generates the transaction hash preimage for the PSBT.
   * @returns The transaction hash preimage as a hexadecimal string.
   * @throws {Error} If the PSBT is not sealed (must call `seal()` first).
   */
  txHashPreimage(): string {
    if (!this._isSealed) {
      // if call .change() but not call .seal(), it will cause the change satoshis is 0
      // here we throw an error to avoid this, toHex() and toBase64() will also check this
      throw new Error('should call seal() before txHashPreimage()');
    }
    return uint8ArrayToHex(this.extractTransaction().toTxHashPreimage());
  }


  /**
   * Finalizes the PSBT by calculating and caching input unlocking scripts,
   * finalizing the change output if specified, and marking the transaction as sealed.
   * Also calculates input contexts after sealing.
   * @returns The sealed PSBT instance for method chaining.
   */
  seal(): this {
  // calculate and cache the input unlockingScripts to calculate the tx size
    for (const [inputIndex, finalizer] of this._finalizers) {
      const unlockingScript = finalizer(this, inputIndex, this.data.inputs[inputIndex]);
      this._cacheInputUnlockScript(inputIndex, unlockingScript);
    }

    if (this._changeToAddr) {
      this.finalizeChangeOutput();
    }
    this._isSealed = true;
    this._ctxProvider.calculateInputCtxs();
    return this;
  }

  /**
   * Converts the PSBT to a Uint8Array buffer.
   * @throws {Error} If the PSBT is not sealed (must call seal() first).
   * @returns {Uint8Array} The serialized PSBT buffer.
   */
  toBuffer(): Uint8Array {
    if (!this._isSealed) {
      // if call .change() but not call .seal(), it will cause the change satoshis is 0
      // here we throw an error to avoid this, toHex() and toBase64() will also check this
      throw new Error('should call seal() before toBuffer()');
    }
    return super.toBuffer();
  }

  /**
   * Converts the PSBT to a hexadecimal string representation.
   * @throws {Error} If the PSBT is not sealed (must call seal() first).
   * @returns {string} The hexadecimal string representation of the PSBT.
   */
  toHex(): string {
    if (!this._isSealed) {
      throw new Error('should call seal() before toHex()');
    }
    return super.toHex();
  }

  /**
   * Converts the PSBT to Base64 string representation.
   * @throws {Error} If the PSBT is not sealed (must call seal() first)
   * @returns {string} Base64 encoded PSBT data
   */
  toBase64(): string {
    if (!this._isSealed) {
      throw new Error('should call seal() before toBase64()');
    }
    return super.toBase64();
  }
}
