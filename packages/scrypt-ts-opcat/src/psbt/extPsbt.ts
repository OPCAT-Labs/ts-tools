
import { PsbtInput, Psbt as PsbtBase, OpcatUtxo } from '@opcat-labs/bip174';
import { ByteString, Sig, SigHashType, StateHashes, TxOut } from '../smart-contract/types/index.js';
import {
  InputIndex, OutputIndex, SupportedNetwork, RawArgs,
  ExtUtxo,
  StatefulContractUtxo,
  StateProvableUtxo,
} from '../globalTypes.js';
import { ToSignInput, SignOptions } from '../signer.js';
import { DUST_LIMIT, TX_INPUT_COUNT_MAX, TX_OUTPUT_COUNT_MAX } from '../smart-contract/consts.js';
import { Script } from '../smart-contract/types/script.js';
import { ContextProvider } from './contextProvider.js';
import {
  hexToUint8Array,
  satoshiToHex,
  uint8ArrayToHex,
} from '../utils/common.js';
import { InputContext } from '../smart-contract/types/context.js';
import { IExtPsbt, ContractCall } from './types.js';
import * as tools from 'uint8array-tools';
import { toByteString } from '../smart-contract/fns/byteString.js';
import { hash256 } from '../smart-contract/fns/index.js';
import { TxUtils } from '../smart-contract/builtin-libs/txUtils.js';

import { FinalScriptsFunc, isFinalized, Psbt, PsbtOptsOptional, PsbtOutputExtended, TransactionInput } from './psbt.js';
import { fromSupportedNetwork } from '../networks.js';
import { Transaction, PublicKey, Networks } from '@opcat-labs/opcat';
import { SmartContract } from '../smart-contract/smartContract.js';
import { OpcatState } from '../smart-contract/types/primitives.js';
import { callArgsToStackToScript } from './bufferutils.js';

const P2PKH_SIG_LEN = 0x49; // 73 bytes signature
const P2PKH_PUBKEY_LEN = 0x21; // 33 bytes pubkey

type Finalizer = (
  self: ExtPsbt,
  inputIndex: number, // Which input is it?
  input: PsbtInput, // The PSBT input contents
) => RawArgs;


export interface PsbtInputExtended extends PsbtInput, TransactionInput {
  opcatUtxo: OpcatUtxo;
  finalizer?: Finalizer;
  sigRequests?: {
    inputIndex: InputIndex;
    options: Omit<ToSignInput, 'index'>;
  }[];
}

export interface ExtPsbtOpts extends Omit<PsbtOptsOptional, 'network'> {
  /**
   * force add state root hash output to the psbt
   *
   * @default false
   *
   * if set true, the psbt will add a state root hash output to the psbt even you did not call addCovenantOutput
   * if set false, the psbt will not add a state root hash output to the psbt if you did not call addCovenantOutput, once you call addCovenantOutput, the psbt will add a state root hash output to the psbt
   */
  forceAddStateRootHashOutput?: boolean;
  /**
   * network config, used by spendUTXO() and change()
   *
   * if you are create a psbt on btc-signet, you should set `network` to avoid address convertion issues, because btc-signet has a different address format.
   *
   * make sure you have set the network if you are working on btc-signet
   */
  network?: Networks.Network | SupportedNetwork;
}

/**
 * Extended [Psbt]{@link https://docs.scrypt.io/btc-docs/references/bitcoinjs-lib/classes/Psbt } class.
 * Used to construct transactions to unlock smart contracts.
 */
export class ExtPsbt extends Psbt implements IExtPsbt {
  constructor(opts: ExtPsbtOpts = {}, data?: PsbtBase) {
    if (typeof opts.network === 'string') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (opts as any as PsbtOptsOptional).network = fromSupportedNetwork(opts.network);
    }
    super(opts as PsbtOptsOptional, data);
    this._ctxProvider = new ContextProvider(this);
  }
  getSequence(inputIndex: InputIndex): number {
    return this.unsignedTx.inputs[inputIndex].sequenceNumber;
  }
  getlockTime(): number {
    return this.unsignedTx.nLockTime;
  }

  static fromBase64(data: string, opts: ExtPsbtOpts = {}): ExtPsbt {
    const buffer = tools.fromBase64(data);
    return this.fromBuffer(buffer, opts);
  }

  static fromHex(data: string, opts: ExtPsbtOpts = {}): ExtPsbt {
    const buffer = tools.fromHex(data);
    return this.fromBuffer(buffer, opts);
  }

  static fromBuffer(buffer: Uint8Array, opts: ExtPsbtOpts = {}): ExtPsbt {
    if (typeof opts.network === 'string') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (opts as any as PsbtOptsOptional).network = fromSupportedNetwork(opts.network);
    }
    const psbt = Psbt.fromBuffer(buffer, opts as PsbtOptsOptional);
    return new ExtPsbt(opts as PsbtOptsOptional, psbt.data);
  }

  private _ctxProvider: ContextProvider;

  private _sigHashTypes: Map<number, SigHashType> = new Map();

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

  getSigHashType(inputIndex: number): SigHashType {
    return this._sigHashTypes.get(inputIndex) as SigHashType;
  }

  getInputCtx(inputIndex: InputIndex): InputContext {
    return this._ctxProvider.getInputCtx(inputIndex);
  }

  getTxoStateHashes(): StateHashes {
    return this._txoStateHashes;
  }

  get stateHashRoot(): ByteString {
    let stateRoots = '';
    for (let i = 0; i < this._txoStateHashes.length; i++) {
      stateRoots += this._txoStateHashes[i];
    }
    return hash256(stateRoots);
  }

  get stateHashRootScript(): Uint8Array {
    return hexToUint8Array(TxUtils.buildStateHashRootScript(this.stateHashRoot));
  }


  private _txoStateHashes: StateHashes;
  private _sigRequests: Map<InputIndex, Omit<ToSignInput, 'index'>[]> = new Map();
  private _finalizers: Map<InputIndex, Finalizer> = new Map();

  private _inputContracts: Map<InputIndex, SmartContract<OpcatState>> = new Map();
  private _inStateProvableUtxos: Map<InputIndex, StatefulContractUtxo> = new Map();
  private _outputContracts: Map<OutputIndex, SmartContract<OpcatState>> = new Map();

  private _changeOutputIndex: number | null = null;
  private _changeToAddr: string;

  private _changeData: Uint8Array;

  private _changeFeeRate: number;

  override addInput(inputData: PsbtInputExtended): this {
    super.addInput(inputData);
    this._checkInputCnt();
    this._checkSealed("can't add more input");
    if (inputData.finalizer) {
      const index = this.data.inputs.length - 1;
      const input = this.data.inputs[index];
      const witness = inputData.finalizer(this, index, input);
      this._cacheInputCallArgs(index, witness);
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

      if (utxo.txoStateHashes && utxo.txHashPreimage) {
        const inputIndex = this.data.inputs.length - 1;
        this._inStateProvableUtxos.set(inputIndex, utxo as StatefulContractUtxo);
      }
    }
    return this;
  }

  override addOutput(outputData: PsbtOutputExtended): this {
    super.addOutput(outputData);
    this._checkOutputCnt();
    this._checkSealed("can't add more output");
    return this;
  }

  override setVersion(version: number): this {
    this._checkSealed("can't setVersion");
    return super.setVersion(version);
  }

  override setLocktime(locktime: number): this {
    this._checkSealed("can't setLocktime");
    return super.setLocktime(locktime);
  }

  override setInputSequence(inputIndex: number, sequence: number): this {
    this._checkSealed("can't setInputSequence");
    return super.setInputSequence(inputIndex, sequence);
  }

  addContractInput(contract: SmartContract<OpcatState>): this {
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
    this._checkInputCnt();

    const inputIndex = this.data.inputs.length - 1;
    this._inputContracts.set(inputIndex, contract);
    if ("txHashPreimage" in fromUtxo && 'txoStateHashes' in fromUtxo) {
      this._inStateProvableUtxos.set(inputIndex, contract.utxo as StatefulContractUtxo);
    }
    return this;
  }

  removeInput(inputIndex: number): this {
    this.unsignedTx.inputs.splice(inputIndex, 1);
    this.data.inputs.splice(inputIndex, 1);
    this._inputContracts.delete(inputIndex);
    this._inStateProvableUtxos.delete(inputIndex);
    this._finalizers.delete(inputIndex);
    this._sigRequests.delete(inputIndex);
    return this;
  }

  removeLastInput(): this {
    const inputIndex = this.data.inputs.length - 1;
    if (inputIndex < 0) {
      throw new Error('No input to remove');
    }
    this.removeInput(inputIndex);
    return this;
  }

  updateContractInput(
    inputIndex: number,
    contractCall: ContractCall,
  ): this {

    const contract = this._inputContracts.get(inputIndex);
    if (!contract) {
      throw new Error(`No contract found for input index ${inputIndex}`);
    }


    // update the contract binding to the current psbt input
    contract.spentFromInput(this, inputIndex);

    contractCall(contract, this);
    const callArgs = contract.getRawArgsOfCallData();

    this._cacheInputCallArgs(inputIndex, callArgs);

    const finalizer: Finalizer = (
      _self: ExtPsbt,
      _inputIndex: number, // Which input is it?
      _input: PsbtInput, // The PSBT input contents
    ) => {
      contractCall(contract, this);
      return contract.getRawArgsOfCallData();
    };
    this._setInputFinalizer(inputIndex, finalizer);

    return this;
  }

  addContractOutput(contract: SmartContract<OpcatState>, satoshis: number, data: Uint8Array): this {


    this.addOutput({
      script: contract.lockingScript.toBuffer(),
      value: BigInt(satoshis),
      data,
    });

    const outputIndex = this.txOutputs.length - 1;

    this._outputContracts.set(outputIndex, contract);

    return this;
  }

  get inputAmount(): number {
    return this.data.inputs.reduce((total, input) => total + Number(input.opcatUtxo!.value), 0);
  }

  get outputAmount(): number {
    return this.txOutputs.reduce((total, output) => total + Number(output.value), 0);
  }

  change(toAddr: string, feeRate: number, data?: Uint8Array): this {
    const changeScript = Script.fromAddress(toAddr);
    data = data || new Uint8Array(0)
    if (this._changeOutputIndex === null) {
      super.addOutput({
        script: changeScript.toBuffer(),
        value: BigInt(0),
        data: data,
      });

      const index = this.txOutputs.length - 1;
      this._changeOutputIndex = index;
    }
    this._changeToAddr = toAddr;
    this._changeFeeRate = feeRate;
    this._changeData = data;
    return this;
  }

  private finalizeChangeOutput(): this {
    if (this._changeOutputIndex === null) {
      return this;
    }

    const estVSize = this.estimateVSize(); // NOTE: this may be inaccurate due to the unknown witness size

    const changeAmount = this.inputAmount - this.outputAmount - estVSize * this._changeFeeRate;

    if (changeAmount < 0) {
      throw new Error('Insufficient input satoshis!');
    }

    if (changeAmount >= DUST_LIMIT) {
      const outputs = this.unsignedTx.outputs;
      outputs[this._changeOutputIndex].satoshis = changeAmount;
    } else {
      this.txOutputs.splice(this._changeOutputIndex, 1);
      this._changeOutputIndex = null;
    }

    return this;
  }

  getChangeInfo(): TxOut {
    if (this._changeOutputIndex !== null) {
      const changeOutput = this.txOutputs[this._changeOutputIndex];
      if (!changeOutput) {
        throw new Error(`Change output is not found at index ${this._changeOutputIndex}`);
      }
      return {
        script: tools.toHex(changeOutput.script),
        satoshis: satoshiToHex(changeOutput.value),
      };
    } else {
      return {
        script: toByteString(''),
        satoshis: toByteString(''),
      };
    }
  }

  get unsignedTx(): Transaction {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const c = (this as any).__CACHE;
    return c.__TX;
  }

  private get network(): Networks.Network {
    // make this get function private to avoid user to call it privately
    // it makes confuse if user pass in a network string to the constructor, but here returns a network object
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (this as any).opts.network || Networks.livenet;
  }

  estimateVSize(): number {
    const compensation = 1; // vsize diff compensation in bytes
    return this.unsignedTx.getEstimateSize() + this._unfinalizedCallArgsSize() + compensation;
  }

  estimateFee(feeRate: number): number {
    return this.estimateVSize() * feeRate;
  }

  private _setInputFinalizer(inputIndex: InputIndex, finalizer: Finalizer): this {
    this._finalizers.set(inputIndex, finalizer);
    return this;
  }

  private _finalizing = false;

  private _isSealed = false;

  get isFinalizing(): boolean {
    return this._finalizing;
  }

  get isSealed(): boolean {
    return this._isSealed;
  }

  override finalizeAllInputs(): this {
    this._finalizing = true;
    this.data.inputs.forEach((input, idx) => {
      let finalFunc: FinalScriptsFunc | undefined = undefined;
      const finalizer = this._finalizers.get(idx);
      if (finalizer) {
        try {
          const callArgs = finalizer(this, idx, input);
          finalFunc = (
            _inputIdx: number,
            _input: PsbtInput,
            _script: Uint8Array, // The "meaningful" locking script Buffer
          ) => {
            return {
              finalScriptSig: callArgsToStackToScript(callArgs),
            };
          };
        } catch (error) {
          throw new Error(`Failed to finalize input ${idx}: ${error.message}, ${error.stack}`);
        }
      }
      this.finalizeInput(idx, finalFunc);
    });

    this._bindCovenantUtxo();

    return this;
  }

  private _bindCovenantUtxo() {
    this._outputContracts.forEach((covenant, outputIndex) => {
      const utxo = this.txOutputs[outputIndex];
      if (covenant.state && Object.keys(covenant.state).length > 0) {
        covenant.bindToUtxo({
          txId: this.unsignedTx.id,
          outputIndex,
          data: uint8ArrayToHex(utxo.data),
          satoshis: Number(utxo.value),
          txoStateHashes: this._txoStateHashes,
          txHashPreimage: uint8ArrayToHex(this.unsignedTx.toTxHashPreimage()),
        });
      } else {
        covenant.bindToUtxo({
          txId: this.unsignedTx.id,
          outputIndex,
          data: uint8ArrayToHex(utxo.data),
          satoshis: Number(utxo.value),
        });
      }
    });
  }

  get isFinalized(): boolean {
    return this.data.inputs.reduce((finalized, input) => {
      return finalized && isFinalized(input);
    }, true);
  }

  private _cacheInputCallArgs(inputIndex: InputIndex, callArgs: RawArgs) {
    // put witness into unknownKeyVals to support autoFinalize in signer
    callArgs.forEach((wit, widx) => {
      this.data.addUnknownKeyValToInput(inputIndex, {
        key: tools.fromUtf8(widx.toString()),
        value: wit,
      });
    });
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
    let size = 0;
    this.data.inputs.forEach((input, _inputIndex) => {
      if (!this.isContractInput(_inputIndex)) {
        // p2pkh
        size += P2PKH_SIG_LEN + P2PKH_PUBKEY_LEN;
      } else {
        // p2tr
        if (!isFinalized(input)) {
          if ((input.unknownKeyVals || []).length > 0) {
            // use unknownKeyVals as a place to store witness before sign
            const unfinalizedWitness = (input.unknownKeyVals || []).map((v) => v.value);
            size += callArgsToStackToScript(unfinalizedWitness).length;
          } else {
            // if no unknownKeyVals, we assume the input is not finalized yet
            // and we should not count the size of finalScriptSig
            // because they are not set yet
            size += 0;
          }
        } else {
          if (input.finalScriptSig) {
            size += input.finalScriptSig.length;
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

  private _checkInputCnt() {
    const inputCnt = this.data.inputs.length;
    if (inputCnt > TX_INPUT_COUNT_MAX) {
      throw new Error(
        `This ExtPsbt has ${inputCnt} inputs which exceeds the limit of ${TX_INPUT_COUNT_MAX}`,
      );
    }
  }

  /**
   * Checks if the number of outputs in the PSBT exceeds the maximum allowed limit.
   * @throws {Error} If the output count exceeds TX_OUTPUT_COUNT_MAX
   * @private
   */
  private _checkOutputCnt() {
    const outputCnt = this.data.outputs.length;
    if (outputCnt > TX_OUTPUT_COUNT_MAX) {
      throw new Error(
        `This ExtPsbt has ${outputCnt} outputs which exceeds the limit of ${TX_OUTPUT_COUNT_MAX}`,
      );
    }
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

  getInputContract(inputIndex: number): SmartContract<OpcatState> | undefined {
    return this._inputContracts.get(inputIndex);
  }

  getStatefulInputUtxo(inputIndex: number): StatefulContractUtxo | undefined {
    return this._inStateProvableUtxos.get(inputIndex);
  }

  getChangeUTXO(): StateProvableUtxo | null {
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

  getUtxo(outputIndex: number): StateProvableUtxo {
    if (!this.txOutputs[outputIndex]) {
      throw new Error(`Output at index ${outputIndex} is not found`);
    }

    const address = Script.fromBuffer(Buffer.from(this.txOutputs[outputIndex].script)).toAddress(this.network);

    return {
      txId: this.unsignedTx.id,
      outputIndex: outputIndex,
      script: uint8ArrayToHex(this.txOutputs[outputIndex].script),
      data: uint8ArrayToHex(this.txOutputs[outputIndex].data),
      address: address.toString(),
      satoshis: Number(this.txOutputs[outputIndex].value),
      txoStateHashes: this.getTxoStateHashes(),
      txHashPreimage: this.txHashPreimage(),
    };
  }

  getStatefulCovenantUtxo(outputIndex: number): StatefulContractUtxo {
    const utxo = this.getUtxo(outputIndex);
    return {
      ...utxo,
      txoStateHashes: this.getTxoStateHashes(),
      txHashPreimage: this.txHashPreimage(),
    };
  }

  isStatefulCovenantUtxo(utxo: object): boolean {
    return (
      typeof utxo === 'object' &&
      utxo !== null &&
      'txoStateHashes' in utxo &&
      'txHashPreimage' in utxo
    );
  }

  txHashPreimage(): string {
    return uint8ArrayToHex(this.unsignedTx.toTxHashPreimage());
  }

  getOutputSatoshisList(): string[] {
    return this.txOutputs.map((output) => satoshiToHex(output.value));
  }

  seal(): this {
    if (this._changeToAddr) {
      this.finalizeChangeOutput();
    }
    this._isSealed = true;
    this._ctxProvider.calculateInputCtxs();
    return this;
  }

  toBuffer(): Uint8Array {
    if (!this._isSealed) {
      // if call .change() but not call .seal(), it will cause the change satoshis is 0
      // here we throw an error to avoid this, toHex() and toBase64() will also check this
      throw new Error('should call seal() before toBuffer()');
    }
    return super.toBuffer();
  }

  toHex(): string {
    if (!this._isSealed) {
      throw new Error('should call seal() before toHex()');
    }
    return super.toHex();
  }

  toBase64(): string {
    if (!this._isSealed) {
      throw new Error('should call seal() before toBase64()');
    }
    return super.toBase64();
  }
}
