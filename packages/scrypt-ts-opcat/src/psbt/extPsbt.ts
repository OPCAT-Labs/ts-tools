import {
  Psbt,
  PsbtOptsOptional,
  Transaction,
  TransactionInput,
  isFinalized,
  address,
  bip341,
  bip371,
  psbtutils,
  psbt,
  networks,
  Network,
} from '@scrypt-inc/bitcoinjs-lib';
import { PsbtInput, Psbt as PsbtBase } from 'bip174';
const { witnessStackToScriptWitness } = psbtutils;
const { LEAF_VERSION_TAPSCRIPT } = bip341;
const { isTaprootInput } = bip371;

import { ByteString, Sig, SigHashType, StateHashes, TxOut } from '../smart-contract/types/index.js';
import {
  Covenant,
  ExtUtxo,
  StatefulCovenant,
  StatefulCovenantUtxo,
  StateProvableUtxo,
} from '../covenant.js';
import { InputIndex, OutputIndex, SupportedNetwork, Witness } from '../globalTypes.js';
import { ToSignInput, SignOptions } from '../signer.js';
import { DUST_LIMIT, TX_INPUT_COUNT_MAX, TX_OUTPUT_COUNT_MAX } from '../smart-contract/consts.js';
import { Script } from '../smart-contract/types/script.js';
import { ContextProvider } from './contextProvider.js';
import {
  emptyStateHashes,
  hexToUint8Array,
  toBitcoinNetwork,
  satoshiToHex,
  toXOnly,
  uint8ArrayToHex,
} from '../utils/common.js';
import { InputContext } from '../smart-contract/types/context.js';
import { IExtPsbt, SubContractCall } from './types.js';
import * as tools from 'uint8array-tools';
import { toByteString } from '../smart-contract/fns/byteString.js';
import { hash160 } from '../smart-contract/fns/index.js';
import { TxUtils } from '../smart-contract/builtin-libs/txUtils.js';

export { type IExtPsbt } from './types.js';

const SCHNORR_SIG_LEN = 0x41; // a normal schnorr signature size with sigHashType is 65 bytes

type Finalizer = (
  self: ExtPsbt,
  inputIndex: number, // Which input is it?
  input: PsbtInput, // The PSBT input contents
  tapLeafHashToFinalize?: Uint8Array,
) => Witness;

// type AsyncFinalizer = (
//   self: IExtPsbt,
//   inputIndex: number, // Which input is it?
//   input: PsbtInput, // The PSBT input contents
//   tapLeafHashToFinalize?: Uint8Array
// ) => Promise<Witness>;

type FinalTaprootScriptsFunc = (
  inputIndex: number, // Which input is it?
  input: PsbtInput, // The PSBT input contents
  tapLeafHashToFinalize?: Uint8Array,
) => {
  finalScriptWitness: Uint8Array | undefined;
};

interface PsbtInputExtended extends PsbtInput, TransactionInput {
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
  network?: SupportedNetwork | Network;
}

/**
 * Extended [Psbt]{@link https://docs.scrypt.io/btc-docs/references/bitcoinjs-lib/classes/Psbt } class.
 * Used to construct transactions to unlock smart contracts.
 */
export class ExtPsbt extends Psbt implements IExtPsbt {
  constructor(opts: ExtPsbtOpts = {}, data?: PsbtBase) {
    if (typeof opts.network === 'string') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (opts as any as PsbtOptsOptional).network = toBitcoinNetwork(opts.network);
    }
    super(opts as PsbtOptsOptional, data);
    this._ctxProvider = new ContextProvider(this);
    this._txoStateHashes = emptyStateHashes();
    if (opts.forceAddStateRootHashOutput && this.txOutputs.length === 0) {
      this.addOutput({
        script: this.stateHashRootScript,
        value: BigInt(0),
      });
      this._stateRootAdded = true;
    }
  }
  getSequence(inputIndex: InputIndex): number {
    return this.unsignedTx.ins[inputIndex].sequence;
  }
  getlockTime(): number {
    return this.unsignedTx.locktime;
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
      (opts as any as PsbtOptsOptional).network = toBitcoinNetwork(opts.network);
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
      stateRoots += hash160(this._txoStateHashes[i]);
    }
    return hash160(stateRoots);
  }

  get stateHashRootScript(): Uint8Array {
    return hexToUint8Array(TxUtils.buildStateHashRootScript(this.stateHashRoot));
  }

  get accessedInputStateProofs(): boolean {
    return Array.from(this._inputCovenants.values()).some(
      (covenant) => covenant.accessedInputStateProofs,
    );
  }

  private _txoStateHashes: StateHashes;
  private _sigRequests: Map<InputIndex, Omit<ToSignInput, 'index'>[]> = new Map();
  private _finalizers: Map<InputIndex, Finalizer> = new Map();

  private _inputCovenants: Map<InputIndex, Covenant> = new Map();
  private _inStateProvableUtxos: Map<InputIndex, StatefulCovenantUtxo> = new Map();
  private _outputCovenants: Map<OutputIndex, Covenant> = new Map();

  private _changeOutputIndex: number | null = null;
  private _changeToAddr: string;
  private _changeFeeRate: number;

  override addInput(inputData: PsbtInputExtended): this {
    super.addInput(inputData);
    this._checkInputCnt();
    this._checkSealed("can't add more input");
    if (inputData.finalizer) {
      const index = this.data.inputs.length - 1;
      const input = this.data.inputs[index];
      const witness = inputData.finalizer(this, index, input);
      this._cacheInputWitness(index, witness);
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
      const sigAddress = address.fromOutputScript(hexToUint8Array(utxo.script), this.network);
      if (utxo.address && sigAddress !== utxo.address) {
        throw new Error('The address of the utxo does not match the network of the psbt');
      }
      this.addInput({
        hash: utxo.txId,
        index: utxo.outputIndex,
        witnessUtxo: {
          script: hexToUint8Array(utxo.script),
          value: BigInt(utxo.satoshis),
        },
        sigRequests: [
          {
            inputIndex: this.txInputs.length,
            options: {
              address: address.fromOutputScript(hexToUint8Array(utxo.script), this.network),
            },
          },
        ],
      });

      if (utxo.txoStateHashes && utxo.txHashPreimage) {
        const inputIndex = this.data.inputs.length - 1;
        this._inStateProvableUtxos.set(inputIndex, utxo as StatefulCovenantUtxo);
      }
    }
    return this;
  }

  override addOutput(outputData: psbt.PsbtOutputExtended): this {
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

  addCovenantInput(covenant: Covenant, subContractAlias?: string): this {
    const fromUtxo = covenant.utxo;
    if (!fromUtxo) {
      throw new Error(
        `The covenant input '${covenant.constructor.name}' does not bind to any UTXO`,
      );
    }
    // verify network match
    if (this.network !== toBitcoinNetwork(covenant.network)) {
      throw new Error('The network of the psbt does not match the network of the covenant');
    }

    const script = Script.fromHex(fromUtxo.script);
    if (!script.equals(covenant.lockingScript)) {
      throw new Error('The covenant is not from the utxo');
    }

    const subContract = covenant.getSubContract(subContractAlias);
    if (!subContract) {
      throw new Error(
        `SubContract '${subContractAlias}' not found in covenant '${covenant.constructor.name}'`,
      );
    }

    this.addInput({
      hash: fromUtxo.txId,
      index: fromUtxo.outputIndex,
      witnessUtxo: {
        script,
        value: BigInt(fromUtxo.satoshis),
      },
      tapLeafScript: [
        {
          leafVersion: LEAF_VERSION_TAPSCRIPT,
          script: subContract.lockingScript,
          controlBlock: hexToUint8Array(subContract.controlBlock),
        },
      ],
    });
    this._checkInputCnt();

    const inputIndex = this.data.inputs.length - 1;
    this._inputCovenants.set(inputIndex, covenant);
    const _covenant = covenant as StatefulCovenant<undefined>;
    if (_covenant.utxo && _covenant.utxo.txHashPreimage && _covenant.utxo.txoStateHashes) {
      this._inStateProvableUtxos.set(inputIndex, _covenant.utxo);
    }
    return this;
  }

  removeInput(inputIndex: number): this {
    this.unsignedTx.ins.splice(inputIndex, 1);
    this.data.inputs.splice(inputIndex, 1);
    this._inputCovenants.delete(inputIndex);
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

  updateCovenantInput(
    inputIndex: number,
    covenant: Covenant,
    subContractCall: SubContractCall,
  ): this {
    const tapLeafScript = this.data.inputs[inputIndex].tapLeafScript;

    const subContract = covenant.getSubContract(subContractCall.contractAlias);

    if (!subContract) {
      throw new Error(`subContract ${subContractCall.contractAlias} not found.`);
    }

    if (tools.compare(subContract.lockingScript, tapLeafScript![0].script) !== 0) {
      throw new Error('tapLeafScript not match.');
    }
    // update the contract binding to the current psbt input
    subContract.spentFromInput(this, inputIndex);

    subContractCall.invokeMethod(subContract, this);
    const witness = subContract.methodCallToWitness();
    covenant.verifyWitnessProgram(witness);
    this._cacheInputWitness(inputIndex, witness);

    const finalizer: Finalizer = (
      _self: ExtPsbt,
      _inputIndex: number, // Which input is it?
      _input: PsbtInput, // The PSBT input contents
      _tapLeafHashToFinalize?: Uint8Array,
    ) => {
      subContractCall.invokeMethod(subContract, this);
      return subContract.methodCallToWitness();
    };
    this._setInputFinalizer(inputIndex, finalizer);

    return this;
  }

  private _stateRootAdded: boolean;

  addCovenantOutput(covenant: Covenant, satoshis: number): this {
    const isStatefulCovenant = covenant instanceof StatefulCovenant;
    if (isStatefulCovenant) {
      if (this.txOutputs.length === 0) {
        // add state hash root output as the first output
        this.addOutput({
          script: this.stateHashRootScript,
          value: BigInt(0),
        });
        this._stateRootAdded = true;
      }

      if (!this._stateRootAdded) {
        throw new Error('The state output should be added before all non-state outputs');
      }
    }

    // verify network match
    if (this.network !== toBitcoinNetwork(covenant.network)) {
      throw new Error('The network of the psbt does not match the network of the covenant');
    }

    this.addOutput({
      script: covenant.lockingScript,
      value: BigInt(satoshis),
    });

    const outputIndex = this.txOutputs.length - 1;
    if (this._stateRootAdded && isStatefulCovenant) {
      this._updateStateHashRootOutput(outputIndex, covenant.stateHash);
    }

    this._outputCovenants.set(outputIndex, covenant);

    return this;
  }

  private _updateStateHashRootOutput(outputIndex: number, stateHash: ByteString) {
    this._txoStateHashes[outputIndex - 1] = stateHash;
    this.unsignedTx.outs[0].script = this.stateHashRootScript;
  }

  get inputAmount(): number {
    return this.data.inputs.reduce((total, input) => total + Number(input.witnessUtxo!.value), 0);
  }

  get outputAmount(): number {
    return this.txOutputs.reduce((total, output) => total + Number(output.value), 0);
  }

  change(toAddr: string, feeRate: number): this {
    const changeScript = address.toOutputScript(toAddr, this.network);

    if (this._changeOutputIndex === null) {
      super.addOutput({
        script: changeScript,
        value: BigInt(0),
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

    const estVSize = this.estimateVSize(); // NOTE: this may be inaccurate due to the unknown witness size

    const changeAmount = this.inputAmount - this.outputAmount - estVSize * this._changeFeeRate;

    if (changeAmount < 0) {
      throw new Error('Insufficient input satoshis!');
    }

    if (changeAmount >= DUST_LIMIT) {
      const outputs = this.unsignedTx.outs;
      outputs[this._changeOutputIndex].value = BigInt(changeAmount);
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

  private get network(): Network {
    // make this get function private to avoid user to call it privately
    // it makes confuse if user pass in a network string to the constructor, but here returns a network object
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (this as any).opts.network || networks.bitcoin;
  }

  estimateVSize(): number {
    const compensation = 1; // vsize diff compensation in bytes
    return this.unsignedTx.virtualSize() + this._unfinalizedWitnessVsize() + compensation;
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
      let finalFunc: FinalTaprootScriptsFunc | undefined = undefined;
      const finalizer = this._finalizers.get(idx);
      if (finalizer) {
        try {
          const witness = finalizer(this, idx, input);
          finalFunc = (
            _inputIdx: number,
            _input: PsbtInput,
            _tapLeafHashToFinalize?: Uint8Array,
          ) => {
            return {
              finalScriptWitness: witnessStackToScriptWitness(witness),
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
    this._outputCovenants.forEach((covenant, outputIndex) => {
      const utxo = this.txOutputs[outputIndex];
      if (covenant instanceof StatefulCovenant) {
        covenant.bindToUtxo({
          txId: this.unsignedTx.getId(),
          outputIndex,
          satoshis: Number(utxo.value),
          txoStateHashes: this._txoStateHashes,
          txHashPreimage: uint8ArrayToHex(this.unsignedTx.toBuffer(undefined, 0, false)),
        });
      } else {
        covenant.bindToUtxo({
          txId: this.unsignedTx.getId(),
          outputIndex,
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

  private _cacheInputWitness(inputIndex: InputIndex, witness: Witness) {
    // put witness into unknownKeyVals to support autoFinalize in signer
    witness.forEach((wit, widx) => {
      this.data.addUnknownKeyValToInput(inputIndex, {
        key: tools.fromUtf8(widx.toString()),
        value: wit,
      });
    });
  }

  private _unfinalizedWitnessVsize(): number {
    let size = 0;
    this.data.inputs.forEach((input, _inputIndex) => {
      if (!isTaprootInput(input)) {
        // p2wpkh
        const P2WPKH_SIG_LEN = 0x49; // 73 bytes signature
        const P2WPKH_PUBKEY_LEN = 0x21; // 33 bytes pubkey
        size += P2WPKH_SIG_LEN + P2WPKH_PUBKEY_LEN;
      } else {
        // p2tr
        if (!isFinalized(input)) {
          if ((input.unknownKeyVals || []).length > 0) {
            // use unknownKeyVals as a place to store witness before sign
            const unfinalizedWitness = (input.unknownKeyVals || []).map((v) => v.value);
            size += witnessStackToScriptWitness(unfinalizedWitness).length;
          } else if ((input.tapLeafScript || []).length > 0) {
            const tapLeafScript = (input.tapLeafScript || [])[0];
            const buffer = new ArrayBuffer(SCHNORR_SIG_LEN);
            const unfinalizedWitness = [
              new Uint8Array(buffer),
              tapLeafScript.script,
              tapLeafScript.controlBlock,
            ];
            size += witnessStackToScriptWitness(unfinalizedWitness).length;
          } else if ((input.tapKeySig || []).length > 0) {
            size += (input.tapKeySig || []).length;
          } else {
            const buffer = new ArrayBuffer(SCHNORR_SIG_LEN);
            const unfinalizedWitness = [new Uint8Array(buffer)];
            size += witnessStackToScriptWitness(unfinalizedWitness).length;
          }
        } else {
          if (input.finalScriptSig) {
            size += input.finalScriptSig.length;
          } else if (input.finalScriptWitness) {
            size += input.finalScriptWitness.length;
          } else {
            throw new Error(
              'The taproot input should be finalized with either finalScriptSig or finalScriptWitness',
            );
          }
        }
      }
    });
    return Math.ceil(size / 4);
  }

  private _checkInputCnt() {
    const inputCnt = this.data.inputs.length;
    if (inputCnt > TX_INPUT_COUNT_MAX) {
      throw new Error(
        `This ExtPsbt has ${inputCnt} inputs which exceeds the limit of ${TX_INPUT_COUNT_MAX}`,
      );
    }
  }

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
    let signature: Uint8Array = Uint8Array.from(new Array(SCHNORR_SIG_LEN).fill(0));
    this._addSigRequest(inputIndex, options);

    if (input.tapScriptSig) {
      const tsSig = input.tapScriptSig.find((tapScriptSig) => {
        const tapleafHashMatch =
          !options.tapLeafHashToSign ||
          tools.toHex(tapScriptSig.leafHash) === options.tapLeafHashToSign;

        if (options.publicKey) {
          const isPubKeyMatch = (sigPubKey: Uint8Array, reqPubKey: string) => {
            const p2trXOnlyPubKey = toXOnly(reqPubKey, true);
            const p2wpkhXOnlyPubKey = toXOnly(reqPubKey, false);
            const sigPubKeyHex = tools.toHex(sigPubKey);
            return p2trXOnlyPubKey === sigPubKeyHex || p2wpkhXOnlyPubKey === sigPubKeyHex;
          };
          const pubKeyMatch = isPubKeyMatch(tapScriptSig.pubkey, options.publicKey);
          return tapleafHashMatch && pubKeyMatch;
        }

        if (options.address) {
          const isP2WPKHPubKeyMatch = (sigPubKey: Uint8Array, hash160PubKey: Uint8Array) => {
            // sigPubKey is an xonly pubkey, so it has no prefix
            const hash160PubKeyHex = tools.toHex(hash160PubKey);
            // prefix refer to https://en.bitcoin.it/wiki/BIP_0137
            const prefixs = ['', '02', '03'];
            for (let i = 0; i < prefixs.length; i++) {
              const prefix = prefixs[i];
              const hash160Res = hash160(prefix + tools.toHex(sigPubKey));
              if (hash160Res === hash160PubKeyHex) {
                return true;
              }
            }
            return false;
          };

          const isP2TRPubKeyMatch = (sigPubKey: Uint8Array, tweakedPubKey: Uint8Array) => {
            return tools.toHex(sigPubKey) === tools.toHex(tweakedPubKey);
          };

          try {
            const result = address.fromBech32(options.address);
            const pubKeyMatch =
              isP2WPKHPubKeyMatch(tapScriptSig.pubkey, result.data) ||
              isP2TRPubKeyMatch(tapScriptSig.pubkey, result.data);
            return tapleafHashMatch && pubKeyMatch;
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
          } catch (error) {
            /* empty */
          }
          return false;
        }

        return false;
      });
      if (tsSig) {
        signature = tsSig.signature;
      }
    }

    // TODO: enable partialSig
    // if (input.partialSig) {
    //   const pSig = input.partialSig.find((partialSig) => {
    //     const sigAddr = xPubkeyToAddr(tools.toHex(partialSig.pubkey))
    //     const reqAddr = options.address || (options.publicKey ? xPubkeyToAddr(options.publicKey) : undefined)
    //     return (reqAddr === undefined || sigAddr === reqAddr)
    //   })
    //   if (pSig) {
    //     signature = pSig.signature
    //   }
    // }

    return Sig(tools.toHex(signature));
  }

  getInputCovernant(inputIndex: number): Covenant | undefined {
    return this._inputCovenants.get(inputIndex);
  }

  getStatefulInputUtxo(inputIndex: number): StatefulCovenantUtxo | undefined {
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
    return {
      txId: this.unsignedTx.getId(),
      outputIndex: outputIndex,
      script: uint8ArrayToHex(this.txOutputs[outputIndex].script),
      address: address.fromOutputScript(this.txOutputs[outputIndex].script, this.network),
      satoshis: Number(this.txOutputs[outputIndex].value),
      txoStateHashes: this.getTxoStateHashes(),
      txHashPreimage: this.txHashPreimage(),
    };
  }

  getStatefulCovenantUtxo(outputIndex: number): StatefulCovenantUtxo {
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
    return uint8ArrayToHex(this.unsignedTx.toBuffer(undefined, 0, false));
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
