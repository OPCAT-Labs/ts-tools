
import { PsbtInput, Psbt as PsbtBase, OpcatUtxo } from '@opcat-labs/bip174';
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
  satoshiToHex,
  uint8ArrayToHex,
} from '../utils/common.js';
import { InputContext } from '../smart-contract/types/context.js';
import { IExtPsbt, ContractCall } from './types.js';
import * as tools from 'uint8array-tools';
import { toByteString } from '../smart-contract/fns/byteString.js';
import { hash256, sha256 } from '../smart-contract/fns/index.js';

import { FinalScriptsFunc, isFinalized, Psbt, PsbtOptsOptional, PsbtOutputExtended, TransactionInput } from './psbt.js';
import { fromSupportedNetwork } from '../networks.js';
import { Transaction, PublicKey, Networks, encoding } from '@opcat-labs/opcat';
import { SmartContract } from '../smart-contract/smartContract.js';
import { OpcatState } from '../smart-contract/types/primitives.js';
import { BacktraceInfo, SpentDataHashes } from '../smart-contract/types/structs.js';
import { UtxoProvider } from '../providers/utxoProvider.js';
import { ChainProvider } from '../providers/chainProvider.js';
import { toTxHashPreimage } from '../utils/proof.js';

const { BufferWriter } = encoding;

const P2PKH_SIG_LEN = 0x49; // 73 bytes signature
const P2PKH_PUBKEY_LEN = 0x21; // 33 bytes pubkey
const DUMMY_CHANGE_SATOSHIS = BigInt(2100e16); // use the max value to avoid change.satoshis size getting bigger when sealing

type Finalizer = (
  self: ExtPsbt,
  inputIndex: number, // Which input is it?
  input: PsbtInput, // The PSBT input contents
) => Script;


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

  async sign(signer: Signer): Promise<void> {
    const signedPsbtHex = await signer.signPsbt(this.toHex(), this.psbtOptions());
    this.combine(ExtPsbt.fromHex(signedPsbtHex)).finalizeAllInputs();
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

  getSpentDataHashes(): SpentDataHashes {

    let spentDataHashes: SpentDataHashes = toByteString('');
    for (let i = 0; i < this.data.inputs.length; i++) {
      spentDataHashes += sha256(tools.toHex(this.data.inputs[i].opcatUtxo.data));
    }

    return spentDataHashes;
  }

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

  override addOutput(outputData: PsbtOutputExtended): this {
    super.addOutput(outputData);
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

  removeInput(inputIndex: number): this {
    this.unsignedTx.inputs.splice(inputIndex, 1);
    this.data.inputs.splice(inputIndex, 1);
    this._inputContracts.delete(inputIndex);
    this._B2GUtxos.delete(inputIndex);
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

  get inputAmount(): bigint {
    // should use bigint here, because the input amount is too large
    // 2100e16 + 1 = 21000000000000000000
    // BigInt(2100e16) + 1n = 21000000000000000001n
    return this.data.inputs.reduce((total, input) => total + input.opcatUtxo!.value, 0n);
  }

  get outputAmount(): bigint {
    return this.txOutputs.reduce((total, output) => total + output.value, 0n);
  }


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

  estimateSize(): number {
    return this.unsignedTx.getEstimateSize() + this._unfinalizedCallArgsSize();
  }

  estimateFee(feeRate: number): number {
    return this.estimateSize() * feeRate;
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

  getB2GInputUtxo(inputIndex: number): B2GUTXO | undefined {
    return this._B2GUtxos.get(inputIndex);
  }

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

  getUtxo(outputIndex: number): ExtUtxo {
    if (!this.txOutputs[outputIndex]) {
      throw new Error(`Output at index ${outputIndex} is not found`);
    }

    const address = Script.fromBuffer(Buffer.from(this.txOutputs[outputIndex].script)).toAddress(this.network);

    return {
      txId: this.extractTransaction().id,
      outputIndex: outputIndex,
      script: uint8ArrayToHex(this.txOutputs[outputIndex].script),
      data: uint8ArrayToHex(this.txOutputs[outputIndex].data),
      address: address.toString(),
      satoshis: Number(this.txOutputs[outputIndex].value),
      txHashPreimage: this.txHashPreimage(),
    };
  }

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

  async calculateBacktraceInfo(provider: UtxoProvider & ChainProvider, prevPrevTxFinder?: (prevTx: Transaction, provider: UtxoProvider & ChainProvider, inputIndex: InputIndex) => Promise<string>): Promise<void> {
    for (let i = 0; i < this.txInputs.length; i++) {
      if (this.isContractInput(i)) {
        const info = await this.getBacktraceInfo(provider, i, prevPrevTxFinder || (async (prevTx: Transaction, provider: UtxoProvider & ChainProvider, inputIndex: InputIndex) => {
          const prevTxId = uint8ArrayToHex(prevTx.inputs[0].prevTxId);
          const prevTxHex = await provider.getRawTransaction(prevTxId);
          return prevTxHex;
        }));
        this._B2GInfos.set(i, info);
      }
    }
  }

  isB2GUtxo(utxo: object): boolean {
    return (
      typeof utxo === 'object' &&
      utxo !== null &&
      'txHashPreimage' in utxo
    );
  }

  txHashPreimage(): string {
    if (!this._isSealed) {
      // if call .change() but not call .seal(), it will cause the change satoshis is 0
      // here we throw an error to avoid this, toHex() and toBase64() will also check this
      throw new Error('should call seal() before txHashPreimage()');
    }
    return uint8ArrayToHex(this.extractTransaction().toTxHashPreimage());
  }

  getOutputSatoshisList(): string[] {
    return this.txOutputs.map((output) => satoshiToHex(output.value));
  }

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
