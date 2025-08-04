/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  Bip32Derivation,
  KeyValue,
  PartialSig,
  PsbtGlobalUpdate,
  PsbtInput,
  PsbtInputUpdate,
  PsbtOutput,
  PsbtOutputUpdate,
  Transaction as ITransaction,
  TransactionFromBuffer,
  checkForInput, 
  checkForOutput,
  Psbt as PsbtBase,
  OPCAT_KEY_BUF
} from '@opcat-labs/bip174';
import { Transaction, Address, Script, crypto, Networks, Network, encoding } from '@opcat-labs/opcat'
import * as signatureutils from './signatureutils.js';
import { cloneBuffer, reverseBuffer } from './bufferutils.js';

import {
  checkInputForSig,
  pubkeyInScript,
} from './psbtutils.js';
import * as tools from 'uint8array-tools';
import { intToByteString } from '../smart-contract/fns/byteString.js';

export interface TransactionInput {
  hash: string | Uint8Array;
  index: number;
  sequence?: number;
}

export interface PsbtTxInput extends TransactionInput {
  hash: Uint8Array;
}

export interface TransactionOutput {
  script: Uint8Array;
  value: bigint;
  data: Uint8Array;
}

export interface PsbtTxOutput extends TransactionOutput {
  address: string | undefined;
}

// msghash is 32 byte hash of preimage, signature is 64 byte compact signature (r,s 32 bytes each)
export type ValidateSigFunction = (
  pubkey: Uint8Array,
  msghash: Uint8Array,
  signature: Uint8Array,
) => boolean;

/**
 * These are the default arguments for a Psbt instance.
 */
const DEFAULT_OPTS: PsbtOpts = {
  /**
   * A bitcoinjs Network object. This is only used if you pass an `address`
   * parameter to addOutput. Otherwise it is not needed and can be left default.
   */
  network: Networks.testnet,
  /**
   * When extractTransaction is called, the fee rate is checked.
   * THIS IS NOT TO BE RELIED ON.
   * It is only here as a last ditch effort to prevent sending a 500 BTC fee etc.
   */
  maximumFeeRate: 5000, // satoshi per byte
};

/**
 * Psbt class can parse and generate a PSBT binary based off of the BIP174.
 * There are 6 roles that this class fulfills. (Explained in BIP174)
 *
 * Creator: This can be done with `new Psbt()`
 *
 * Updater: This can be done with `psbt.addInput(input)`, `psbt.addInputs(inputs)`,
 *   `psbt.addOutput(output)`, `psbt.addOutputs(outputs)` when you are looking to
 *   add new inputs and outputs to the PSBT, and `psbt.updateGlobal(itemObject)`,
 *   `psbt.updateInput(itemObject)`, `psbt.updateOutput(itemObject)`
 *   addInput requires hash: Buffer | string; and index: number; as attributes
 *   and can also include any attributes that are used in updateInput method.
 *   addOutput requires script: Buffer; and value: number; and likewise can include
 *   data for updateOutput.
 *   For a list of what attributes should be what types. Check the bip174 library.
 *   Also, check the integration tests for some examples of usage.
 *
 * Signer: There are a few methods. signAllInputs and signAllInputsAsync, which will search all input
 *   information for your pubkey or pubkeyhash, and only sign inputs where it finds
 *   your info. Or you can explicitly sign a specific input with signInput and
 *   signInputAsync. For the async methods you can create a SignerAsync object
 *   and use something like a hardware wallet to sign with. (You must implement this)
 *
 * Combiner: psbts can be combined easily with `psbt.combine(psbt2, psbt3, psbt4 ...)`
 *   the psbt calling combine will always have precedence when a conflict occurs.
 *   Combine checks if the internal bitcoin transaction is the same, so be sure that
 *   all sequences, version, locktime, etc. are the same before combining.
 *
 * Input Finalizer: This role is fairly important. Not only does it need to construct
 *   the input scriptSigs and witnesses, but it SHOULD verify the signatures etc.
 *   Before running `psbt.finalizeAllInputs()` please run `psbt.validateSignaturesOfAllInputs()`
 *   Running any finalize method will delete any data in the input(s) that are no longer
 *   needed due to the finalized scripts containing the information.
 *
 * Transaction Extractor: This role will perform some checks before returning a
 *   Transaction object. Such as fee rate not being larger than maximumFeeRate etc.
 */
export class Psbt {
  static fromBase64(data: string, opts: PsbtOptsOptional = {}): Psbt {
    const buffer = tools.fromBase64(data);
    return this.fromBuffer(buffer, opts);
  }

  static fromHex(data: string, opts: PsbtOptsOptional = {}): Psbt {
    const buffer = tools.fromHex(data);
    return this.fromBuffer(buffer, opts);
  }

  static fromBuffer(buffer: Uint8Array, opts: PsbtOptsOptional = {}): Psbt {
    const psbtBase = PsbtBase.fromBuffer(buffer, transactionFromBuffer);
    const psbt = new Psbt(opts, psbtBase);
    psbt._assertOpcatPsbt();
    checkTxForDupeIns(psbt.__CACHE.__TX, psbt.__CACHE);
    return psbt;
  }

  private __CACHE: PsbtCache;
  private opts: PsbtOpts;

  constructor(
    opts: PsbtOptsOptional = {},
    readonly data: PsbtBase = new PsbtBase(new PsbtTransaction()),
  ) {
    // set defaults
    this.opts = Object.assign({}, DEFAULT_OPTS, opts);
    this.__CACHE = {
      __TX_IN_CACHE: {},
      __TX: (this.data.globalMap.unsignedTx as PsbtTransaction).tx,
      // Psbt's predecessor (TransactionBuilder - now removed) behavior
      // was to not confirm input values  before signing.
      // Even though we highly encourage people to get
      // the full parent transaction to verify values, the ability to
      // sign non-segwit inputs without the full transaction was often
      // requested. So the only way to activate is to use @ts-ignore.
      // We will disable exporting the Psbt when unsafe sign is active.
      // because it is not BIP174 compliant.
      __UNSAFE_SIGN_NONSEGWIT: false,
    };
    this._restoreTxOutputData();
    
    //if (this.data.inputs.length === 0) this.setVersion(2);

    for (let i = 0; i < this.__CACHE.__TX.inputs.length; i++) {
      const input = this.__CACHE.__TX.inputs[i];
      if(!this.data.inputs[i] || !this.data.inputs[i].opcatUtxo) {
        throw new Error('invalid pbst input')
      }
      input.output =  new Transaction.Output({
        satoshis: Number(this.data.inputs[i].opcatUtxo.value),
        script: new Script(Buffer.from(this.data.inputs[i].opcatUtxo.script)),
        data: Buffer.from(this.data.inputs[i].opcatUtxo.data),
      })
    }

    // Make data hidden when enumerating
    const dpew = (
      obj: any,
      attr: string,
      enumerable: boolean,
      writable: boolean,
    ): any =>
      Object.defineProperty(obj, attr, {
        enumerable,
        writable,
      });
    dpew(this, '__CACHE', false, true);
    dpew(this, 'opts', false, true);
  }

  get inputCount(): number {
    return this.data.inputs.length;
  }

  get version(): number {
    return this.__CACHE.__TX.version;
  }

  set version(version: number) {
    this.setVersion(version);
  }

  get locktime(): number {
    return this.__CACHE.__TX.nLockTime;
  }

  set locktime(locktime: number) {
    this.setLocktime(locktime);
  }

  get txInputs(): PsbtTxInput[] {
    return this.__CACHE.__TX.inputs.map(input => ({
      hash: Buffer.from(input.prevTxId).reverse(),
      index: input.outputIndex,
      sequence: input.sequenceNumber,
    }));
  }

  get txOutputs(): PsbtTxOutput[] {
    return this.__CACHE.__TX.outputs.map(output => {
      let address;
      try {
        address = Address.fromHex(output.script.toHex(), this.opts.network)
      // eslint-disable-next-line no-empty
      } catch (_) {}
      return {
        script: cloneBuffer(output.script.toBuffer()),
        value: BigInt(output.satoshis),
        data: output.data || new Uint8Array(),
        address,
      };
    });
  }

  combine(...those: Psbt[]): this {
    this.data.combine(...those.map(o => o.data));
    return this;
  }

  clone(): Psbt {
    // TODO: more efficient cloning
    const res = Psbt.fromBuffer(this.data.toBuffer());
    res.opts = JSON.parse(JSON.stringify(this.opts));
    return res;
  }

  setMaximumFeeRate(satoshiPerByte: number): void {
    check32Bit(satoshiPerByte); // 42.9 BTC per byte IS excessive... so throw
    this.opts.maximumFeeRate = satoshiPerByte;
  }

  setVersion(version: number): this {
    check32Bit(version);
    checkInputsForPartialSig(this.data.inputs, 'setVersion');
    const c = this.__CACHE;
    c.__TX.version = version;
    c.__EXTRACTED_TX = undefined;
    return this;
  }

  setLocktime(locktime: number): this {
    check32Bit(locktime);
    checkInputsForPartialSig(this.data.inputs, 'setLocktime');
    const c = this.__CACHE;
    c.__TX.nLockTime = locktime;
    c.__EXTRACTED_TX = undefined;
    return this;
  }

  setInputSequence(inputIndex: number, sequence: number): this {
    check32Bit(sequence);
    checkInputsForPartialSig(this.data.inputs, 'setInputSequence');
    const c = this.__CACHE;
    if (c.__TX.inputs.length <= inputIndex) {
      throw new Error('Input index too high');
    }
    c.__TX.inputs[inputIndex].sequenceNumber = sequence;
    c.__EXTRACTED_TX = undefined;
    return this;
  }

  addInputs(inputDatas: PsbtInputExtended[]): this {
    inputDatas.forEach(inputData => this.addInput(inputData));
    return this;
  }

  addInput(inputData: PsbtInputExtended): this {
    if (
      arguments.length > 1 ||
      !inputData ||
      inputData.hash === undefined ||
      inputData.index === undefined ||
      inputData.opcatUtxo === undefined
    ) {
      throw new Error(
        `Invalid arguments for Psbt.addInput. ` +
          `Requires single object with at least [hash] and [index] and [opcatUtxo]`,
      );
    }
    checkInputsForPartialSig(this.data.inputs, 'addInput');
    const c = this.__CACHE;
    this.data.addInput(inputData);
    const txIn = c.__TX.inputs[c.__TX.inputs.length - 1];
    checkTxInputCache(c, txIn);

    c.__FEE = undefined;
    c.__FEE_RATE = undefined;
    c.__EXTRACTED_TX = undefined;
    return this;
  }

  addOutputs(outputDatas: PsbtOutputExtended[]): this {
    outputDatas.forEach(outputData => this.addOutput(outputData));
    return this;
  }

  addOutput(outputData: PsbtOutputExtended): this {
    if (
      arguments.length > 1 ||
      !outputData ||
      outputData.value === undefined ||
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ((outputData as any).address === undefined &&
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (outputData as any).script === undefined &&
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (outputData as any).data === undefined)
    ) {
      throw new Error(
        `Invalid arguments for Psbt.addOutput. ` +
          `Requires single object with at least [script or address] and [value]`,
      );
    }
    checkInputsForPartialSig(this.data.inputs, 'addOutput');
    const { address } = outputData as any;
    if (typeof address === 'string') {
      const script = tools.fromHex(Script.fromAddress(address).toHex());
      outputData = Object.assign({}, outputData, { script });
    }
    const c = this.__CACHE;
    this.data.addOutput(outputData);
    c.__FEE = undefined;
    c.__FEE_RATE = undefined;
    c.__EXTRACTED_TX = undefined;
    return this;
  }

  extractTransaction(disableFeeCheck?: boolean): Transaction {
    if (!this.data.inputs.every(isFinalized)) throw new Error('Not finalized');
    const c = this.__CACHE;
    if (!disableFeeCheck) {
      checkFees(this, c, this.opts);
    }
    if (c.__EXTRACTED_TX) return c.__EXTRACTED_TX;
    const tx = c.__TX.clone();
    inputFinalizeGetAmts(this.data.inputs, tx, c, true);
    return tx;
  }

  getFeeRate(): number {
    return getTxCacheValue(
      '__FEE_RATE',
      'fee rate',
      this.data.inputs,
      this.__CACHE,
    )! as number;
  }

  getFee(): bigint {
    return getTxCacheValue(
      '__FEE',
      'fee',
      this.data.inputs,
      this.__CACHE,
    )! as bigint;
  }

  finalizeAllInputs(): this {
    checkForInput(this.data.inputs, 0); // making sure we have at least one
    range(this.data.inputs.length).forEach(idx => this.finalizeInput(idx));
    return this;
  }

  finalizeInput(
    inputIndex: number,
    finalScriptsFunc?: FinalScriptsFunc,
  ): this {
    const input = checkForInput(this.data.inputs, inputIndex);
    return this._finalizeInput(
      inputIndex,
      input,
      finalScriptsFunc as FinalScriptsFunc,
    );
  }

  private _finalizeInput(
    inputIndex: number,
    input: PsbtInput,
    finalScriptsFunc: FinalScriptsFunc = getFinalScripts,
  ): this {
    const { script } = getScriptFromInput(
      inputIndex,
      input,
      this.__CACHE,
    );
    if (!script) throw new Error(`No script found for input #${inputIndex}`);

    checkPartialSigSighashes(input);

    const { finalScriptSig } = finalScriptsFunc(
      inputIndex,
      input,
      script,
    );

    if (finalScriptSig) this.data.updateInput(inputIndex, { finalScriptSig });
    else throw new Error(`Unknown error finalizing input #${inputIndex}`);      

    this.data.clearFinalizedInput(inputIndex);
    return this;
  }

  getInputType(inputIndex: number): AllScriptType {
    const input = checkForInput(this.data.inputs, inputIndex);
    const script = getScriptFromUtxo(inputIndex, input, this.__CACHE);
    const result = getMeaningfulScript(
      script,
    );
    const type = result.type === 'raw' ? '' : result.type + '-';
    const mainType = classifyScript(result.meaningfulScript);
    return (type + mainType) as AllScriptType;
  }

  inputHasPubkey(inputIndex: number, pubkey: Uint8Array): boolean {
    const input = checkForInput(this.data.inputs, inputIndex);
    return pubkeyInInput(pubkey, input, inputIndex, this.__CACHE);
  }

  inputHasHDKey(inputIndex: number, root: HDSigner): boolean {
    const input = checkForInput(this.data.inputs, inputIndex);
    const derivationIsMine = bip32DerivationIsMine(root);
    return (
      !!input.bip32Derivation && input.bip32Derivation.some(derivationIsMine)
    );
  }

  outputHasPubkey(outputIndex: number, pubkey: Uint8Array): boolean {
    return pubkeyInOutput(pubkey, outputIndex, this.__CACHE);
  }

  outputHasHDKey(outputIndex: number, root: HDSigner): boolean {
    const output = checkForOutput(this.data.outputs, outputIndex);
    const derivationIsMine = bip32DerivationIsMine(root);
    return (
      !!output.bip32Derivation && output.bip32Derivation.some(derivationIsMine)
    );
  }

  validateSignaturesOfAllInputs(validator: ValidateSigFunction): boolean {
    checkForInput(this.data.inputs, 0); // making sure we have at least one
    const results = range(this.data.inputs.length).map(idx =>
      this.validateSignaturesOfInput(idx, validator),
    );
    return results.reduce((final, res) => res === true && final, true);
  }

  validateSignaturesOfInput(
    inputIndex: number,
    validator: ValidateSigFunction,
    pubkey?: Uint8Array,
  ): boolean {
    return this._validateSignaturesOfInput(inputIndex, validator, pubkey);
  }

  private _validateSignaturesOfInput(
    inputIndex: number,
    validator: ValidateSigFunction,
    pubkey?: Uint8Array,
  ): boolean {
    const input = this.data.inputs[inputIndex];
    const partialSig = (input || {}).partialSig as PartialSig[];
    if (!input || !partialSig || partialSig.length < 1)
      throw new Error('No signatures to validate');
    if (typeof validator !== 'function')
      throw new Error('Need validator function to validate signatures');
    const mySigs = pubkey
      ? partialSig.filter(sig => tools.compare(sig.pubkey, pubkey) === 0)
      : partialSig;
    if (mySigs.length < 1) throw new Error('No signatures for this pubkey');
    const results: boolean[] = [];
    let hashCache: Uint8Array;
    let scriptCache: Uint8Array;
    let sighashCache: number;
    for (const pSig of mySigs) {
      const sig = signatureutils.decode(pSig.signature);
      const { hash, script } =
        sighashCache! !== sig.hashType
          ? getHashForSig(
              inputIndex,
              Object.assign({}, input, { sighashType: sig.hashType }),
              this.__CACHE,
            )
          : { hash: hashCache!, script: scriptCache! };
      sighashCache = sig.hashType;
      hashCache = hash;
      scriptCache = script;
      checkScriptForPubkey(pSig.pubkey, script, 'verify');
      results.push(validator(pSig.pubkey, hash, sig.signature));
    }
    return results.every(res => res === true);
  }


  signAllInputsHD(
    hdKeyPair: HDSigner,
    sighashTypes: number[] = [crypto.Signature.SIGHASH_ALL],
  ): this {
    if (!hdKeyPair || !hdKeyPair.publicKey || !hdKeyPair.fingerprint) {
      throw new Error('Need HDSigner to sign input');
    }

    const results: boolean[] = [];
    for (const i of range(this.data.inputs.length)) {
      try {
        this.signInputHD(i, hdKeyPair, sighashTypes);
        results.push(true);
      } catch (_) {
        results.push(false);
      }
    }
    if (results.every(v => v === false)) {
      throw new Error('No inputs were signed');
    }
    return this;
  }

  signAllInputsHDAsync(
    hdKeyPair: HDSigner | HDSignerAsync,
    sighashTypes: number[] = [crypto.Signature.SIGHASH_ALL],
  ): Promise<void> {
    return new Promise((resolve, reject): any => {
      if (!hdKeyPair || !hdKeyPair.publicKey || !hdKeyPair.fingerprint) {
        return reject(new Error('Need HDSigner to sign input'));
      }

      const results: boolean[] = [];
      const promises: Array<Promise<void>> = [];
      for (const i of range(this.data.inputs.length)) {
        promises.push(
          this.signInputHDAsync(i, hdKeyPair, sighashTypes).then(
            () => {
              results.push(true);
            },
            () => {
              results.push(false);
            },
          ),
        );
      }
      return Promise.all(promises).then(() => {
        if (results.every(v => v === false)) {
          return reject(new Error('No inputs were signed'));
        }
        resolve();
      });
    });
  }

  signInputHD(
    inputIndex: number,
    hdKeyPair: HDSigner,
    sighashTypes: number[] = [crypto.Signature.SIGHASH_ALL],
  ): this {
    if (!hdKeyPair || !hdKeyPair.publicKey || !hdKeyPair.fingerprint) {
      throw new Error('Need HDSigner to sign input');
    }
    const signers = getSignersFromHD(
      inputIndex,
      this.data.inputs,
      hdKeyPair,
    ) as Signer[];
    signers.forEach(signer => this.signInput(inputIndex, signer, sighashTypes));
    return this;
  }

  signInputHDAsync(
    inputIndex: number,
    hdKeyPair: HDSigner | HDSignerAsync,
    sighashTypes: number[] = [crypto.Signature.SIGHASH_ALL],
  ): Promise<void> {
    return new Promise((resolve, reject): any => {
      if (!hdKeyPair || !hdKeyPair.publicKey || !hdKeyPair.fingerprint) {
        return reject(new Error('Need HDSigner to sign input'));
      }
      const signers = getSignersFromHD(inputIndex, this.data.inputs, hdKeyPair);
      const promises = signers.map(signer =>
        this.signInputAsync(inputIndex, signer, sighashTypes),
      );
      return Promise.all(promises)
        .then(() => {
          resolve();
        })
        .catch(reject);
    });
  }

  signAllInputs(keyPair: Signer, sighashTypes?: number[]): this {
    if (!keyPair || !keyPair.publicKey)
      throw new Error('Need Signer to sign input');

    // TODO: Add a pubkey/pubkeyhash cache to each input
    // as input information is added, then eventually
    // optimize this method.
    const results: boolean[] = [];
    for (const i of range(this.data.inputs.length)) {
      try {
        this.signInput(i, keyPair, sighashTypes);
        results.push(true);
      } catch (_) {
        results.push(false);
      }
    }
    if (results.every(v => v === false)) {
      throw new Error('No inputs were signed');
    }
    return this;
  }

  signAllInputsAsync(
    keyPair: Signer | SignerAsync,
    sighashTypes?: number[],
  ): Promise<void> {
    return new Promise((resolve, reject): any => {
      if (!keyPair || !keyPair.publicKey)
        return reject(new Error('Need Signer to sign input'));

      // TODO: Add a pubkey/pubkeyhash cache to each input
      // as input information is added, then eventually
      // optimize this method.
      const results: boolean[] = [];
      const promises: Array<Promise<void>> = [];
      for (const [i] of this.data.inputs.entries()) {
        promises.push(
          this.signInputAsync(i, keyPair, sighashTypes).then(
            () => {
              results.push(true);
            },
            () => {
              results.push(false);
            },
          ),
        );
      }
      return Promise.all(promises).then(() => {
        if (results.every(v => v === false)) {
          return reject(new Error('No inputs were signed'));
        }
        resolve();
      });
    });
  }

  signInput(
    inputIndex: number,
    keyPair: Signer,
    sighashTypes?: number[],
  ): this {
    if (!keyPair || !keyPair.publicKey)
      throw new Error('Need Signer to sign input');
    return this._signInput(inputIndex, keyPair, sighashTypes);
  }

  private _signInput(
    inputIndex: number,
    keyPair: Signer,
    sighashTypes: number[] = [crypto.Signature.SIGHASH_ALL],
  ): this {
    const { hash, sighashType } = getHashAndSighashType(
      this.data.inputs,
      inputIndex,
      this.__CACHE,
      sighashTypes,
    );

    const partialSig = [
      {
        pubkey: keyPair.publicKey,
        signature: signatureutils.encode(keyPair.sign(hash), sighashType),
      },
    ];

    this.data.updateInput(inputIndex, { partialSig });
    return this;
  }

  signInputAsync(
    inputIndex: number,
    keyPair: Signer | SignerAsync,
    sighashTypes?: number[],
  ): Promise<void> {
    return Promise.resolve().then(() => {
      if (!keyPair || !keyPair.publicKey)
        throw new Error('Need Signer to sign input');

      return this._signInputAsync(inputIndex, keyPair, sighashTypes);
    });
  }


  private _signInputAsync(
    inputIndex: number,
    keyPair: Signer | SignerAsync,
    sighashTypes: number[] = [crypto.Signature.SIGHASH_ALL],
  ): Promise<void> {
    const { hash, sighashType } = getHashAndSighashType(
      this.data.inputs,
      inputIndex,
      this.__CACHE,
      sighashTypes,
    );

    return Promise.resolve(keyPair.sign(hash)).then(signature => {
      const partialSig = [
        {
          pubkey: keyPair.publicKey,
          signature: signatureutils.encode(signature, sighashType),
        },
      ];

      this.data.updateInput(inputIndex, { partialSig });
    });
  }

  private _setOpcatKV(): void {
    // set global opcat tag
    const findGlobalOpcatKV = (this.data.globalMap.unknownKeyVals || []).find(kv => (OPCAT_KEY_BUF).equals(kv.key));
    if (!findGlobalOpcatKV) {
      this.data.addUnknownKeyValToGlobal({
        key: OPCAT_KEY_BUF,
        value: Buffer.from([1])
      })
    }

    // add output data to output 
    this.data.outputs.forEach((output, outputIndex) => {
      const opcatKV = (output.unknownKeyVals || []).find(kv => (OPCAT_KEY_BUF).equals(kv.key));
      if (opcatKV) {
        output.unknownKeyVals.splice(output.unknownKeyVals.indexOf(opcatKV), 1);
      }
      output.unknownKeyVals.push({
        key: OPCAT_KEY_BUF,
        value: this.__CACHE.__TX.outputs[outputIndex].data || Buffer.from([])
      })
    })
  }

  private _restoreTxOutputData(): void {
    this.data.outputs.forEach((output, outputIndex) => {
      const opcatKV = (output.unknownKeyVals || []).find(kv => (OPCAT_KEY_BUF).equals(kv.key));
      if (!opcatKV) {
        throw new Error('Opcat PSBT is not valid, missing opcat data for output ' + outputIndex);
      }
      this.__CACHE.__TX.outputs[outputIndex].setData(Buffer.from(opcatKV.value));
    })
  }

  private _assertOpcatPsbt(): void {
    const findGlobalOpcatKV = (this.data.globalMap.unknownKeyVals || []).find(kv => (OPCAT_KEY_BUF).equals(kv.key));
    if (!findGlobalOpcatKV) {
      throw new Error('Opcat PSBT is not valid');
    }
  }

  toBuffer(): Uint8Array {
    checkCache(this.__CACHE);
    this._setOpcatKV();
    return this.data.toBuffer();
  }

  toHex(): string {
    checkCache(this.__CACHE);
    this._setOpcatKV();
    return this.data.toHex();
  }

  toBase64(): string {
    checkCache(this.__CACHE);
    this._setOpcatKV();
    return this.data.toBase64();
  }

  updateGlobal(updateData: PsbtGlobalUpdate): this {
    this.data.updateGlobal(updateData);
    return this;
  }

  updateInput(inputIndex: number, updateData: PsbtInputUpdate): this {
    this.data.updateInput(inputIndex, updateData);
    return this;
  }

  updateOutput(outputIndex: number, updateData: PsbtOutputUpdate): this {
    this.data.updateOutput(outputIndex, updateData);
    return this;
  }

  addUnknownKeyValToGlobal(keyVal: KeyValue): this {
    this.data.addUnknownKeyValToGlobal(keyVal);
    return this;
  }

  addUnknownKeyValToInput(inputIndex: number, keyVal: KeyValue): this {
    this.data.addUnknownKeyValToInput(inputIndex, keyVal);
    return this;
  }

  addUnknownKeyValToOutput(outputIndex: number, keyVal: KeyValue): this {
    this.data.addUnknownKeyValToOutput(outputIndex, keyVal);
    return this;
  }

  clearFinalizedInput(inputIndex: number): this {
    this.data.clearFinalizedInput(inputIndex);
    return this;
  }
}

interface PsbtCache {
  __TX_IN_CACHE: { [index: string]: number };
  __TX: Transaction;
  __FEE_RATE?: number;
  __FEE?: bigint;
  __EXTRACTED_TX?: Transaction;
  __UNSAFE_SIGN_NONSEGWIT: boolean;
}

export interface PsbtOptsOptional {
  network?: Network;
  maximumFeeRate?: number;
}

export interface PsbtOpts {
  network: Network;
  maximumFeeRate: number;
}

export interface PsbtInputExtended extends PsbtInput, TransactionInput {}

export type PsbtOutputExtended =
  | PsbtOutputExtendedAddress
  | PsbtOutputExtendedScript;

export interface PsbtOutputExtendedAddress extends PsbtOutput {
  address: string;
  value: bigint;
  data: Uint8Array;
}

export interface PsbtOutputExtendedScript extends PsbtOutput {
  script: Uint8Array;
  value: bigint;
  data: Uint8Array;
}

interface HDSignerBase {
  /**
   * DER format compressed publicKey buffer
   */
  publicKey: Uint8Array;
  /**
   * The first 4 bytes of the sha256-ripemd160 of the publicKey
   */
  fingerprint: Uint8Array;
}

export interface HDSigner extends HDSignerBase {
  /**
   * The path string must match /^m(\/\d+'?)+$/
   * ex. m/44'/0'/0'/1/23 levels with ' must be hard derivations
   */
  derivePath(path: string): HDSigner;
  /**
   * Input hash (the "message digest") for the signature algorithm
   * Return a 64 byte signature (32 byte r and 32 byte s in that order)
   */
  sign(hash: Uint8Array): Uint8Array;
}

/**
 * Same as above but with async sign method
 */
export interface HDSignerAsync extends HDSignerBase {
  derivePath(path: string): HDSignerAsync;
  sign(hash: Uint8Array): Promise<Uint8Array>;
}

export interface Signer {
  publicKey: Uint8Array;
  network?: any;
  sign(hash: Uint8Array, lowR?: boolean): Uint8Array;
  getPublicKey?(): Uint8Array;
}

export interface SignerAsync {
  publicKey: Uint8Array;
  network?: any;
  sign(hash: Uint8Array, lowR?: boolean): Promise<Uint8Array>;
  getPublicKey?(): Uint8Array;
}

/**
 * This function is needed to pass to the bip174 base class's fromBuffer.
 * It takes the "transaction buffer" portion of the psbt buffer and returns a
 * Transaction (From the bip174 library) interface.
 */
const transactionFromBuffer: TransactionFromBuffer = (
  buffer: Uint8Array,
): ITransaction => new PsbtTransaction(buffer);

/**
 * This class implements the Transaction interface from bip174 library.
 * It contains a bitcoinjs-lib Transaction object.
 */
class PsbtTransaction implements ITransaction {
  tx: Transaction;
  constructor(
    buffer: Uint8Array = Uint8Array.from([1, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
  ) {
    this.tx = txFromBitcoinBuffer(Buffer.from(buffer));
    // this.tx = Transaction.fromBitcoinBuffer(Buffer.from(buffer));
    checkTxEmpty(this.tx);
    Object.defineProperty(this, 'tx', {
      enumerable: false,
      writable: true,
    });
  }

  getInputOutputCounts(): {
    inputCount: number;
    outputCount: number;
  } {
    return {
      inputCount: this.tx.inputs.length,
      outputCount: this.tx.outputs.length,
    };
  }

  addInput(input: any): void {
    if (
      (input as any).hash === undefined ||
      (input as any).index === undefined ||
      (input as any).opcatUtxo === undefined ||
      (!((input as any).hash instanceof Uint8Array) &&
        typeof (input as any).hash !== 'string') ||
      typeof (input as any).index !== 'number'
    ) {
      throw new Error('Error adding input.');
    }
    const prevTxId = typeof input.hash === 'string'
        ? input.hash
        : reverseBuffer(tools.fromHex(input.hash));
      
    this.tx.addInput(new Transaction.Input({
      prevTxId: prevTxId,
      outputIndex: input.index,
      sequenceNumber: input.sequence
    }), Script.fromBuffer(Buffer.from(input.opcatUtxo.script)), Number(input.opcatUtxo.value), Buffer.from(input.opcatUtxo.data));
  }

  addOutput(output: any): void {
    if (
      (output as any).script === undefined ||
      (output as any).data === undefined ||
      (output as any).value === undefined ||
      !((output as any).script instanceof Uint8Array) ||
      !((output as any).data instanceof Uint8Array) ||
      typeof (output as any).value !== 'bigint'
    ) {
      throw new Error('Error adding output.');
    }

    this.tx.addOutput(new Transaction.Output({
      script: Script.fromBuffer(Buffer.from(output.script)),
      satoshis: Number(output.value),
      data: Buffer.from(output.data),
    }))
  }

  toBuffer(): Uint8Array {
    return txToBitcoinBuffer(this.tx);
    // return this.tx.toBitcoinBuffer()
  }
}

function canFinalize(
  input: PsbtInput,
  script: Uint8Array,
  scriptType: string,
): boolean {
  switch (scriptType) {
    case 'pubkey':
    case 'pubkeyhash':
      return hasSigs(1, input.partialSig);
    case 'multisig': 
      {
        const ls = Script.fromBuffer(Buffer.from(script));

        if(!ls.isMultisigOut()) {
          throw new Error('Script is not a multisig output');
        }

        const p2ms = ls.decodeMultisigOut();

        return hasSigs(p2ms.m!, input.partialSig, p2ms.pubkeys);
      }
    default:
      return false;
  }
}

function checkCache(cache: PsbtCache): void {
  if (cache.__UNSAFE_SIGN_NONSEGWIT !== false) {
    throw new Error('Not BIP174 compliant, can not export');
  }
}

function hasSigs(
  neededSigs: number,
  partialSig?: any[],
  pubkeys?: Uint8Array[],
): boolean {
  if (!partialSig) return false;
  let sigs: any;
  if (pubkeys) {
    sigs = pubkeys
      .map(pkey => {
        const pubkey = compressPubkey(pkey);
        return partialSig.find(
          pSig => tools.compare(pSig.pubkey, pubkey) === 0,
        );
      })
      .filter(v => !!v);
  } else {
    sigs = partialSig;
  }
  if (sigs.length > neededSigs) throw new Error('Too many signatures');
  return sigs.length === neededSigs;
}

export function isFinalized(input: PsbtInput): boolean {
  return !!input.finalScriptSig || !!input.finalScriptWitness;
}

function bip32DerivationIsMine(
  root: HDSigner,
): (d: Bip32Derivation) => boolean {
  return (d: Bip32Derivation): boolean => {
    if (tools.compare(root.fingerprint, d.masterFingerprint)) return false;
    if (tools.compare(root.derivePath(d.path).publicKey, d.pubkey))
      return false;
    return true;
  };
}

function check32Bit(num: number): void {
  if (
    typeof num !== 'number' ||
    num !== Math.floor(num) ||
    num > 0xffffffff ||
    num < 0
  ) {
    throw new Error('Invalid 32 bit integer');
  }
}

function checkFees(psbt: Psbt, cache: PsbtCache, opts: PsbtOpts): void {
  const feeRate = cache.__FEE_RATE || psbt.getFeeRate();
  const vsize = cache.__EXTRACTED_TX!.getEstimateSize();
  const satoshis = feeRate * vsize;
  if (feeRate >= opts.maximumFeeRate) {
    throw new Error(
      `Warning: You are paying around ${(satoshis / 1e8).toFixed(8)} in ` +
        `fees, which is ${feeRate} satoshi per byte for a transaction ` +
        `with a VSize of ${vsize} bytes (segwit counted as 0.25 byte per ` +
        `byte). Use setMaximumFeeRate method to raise your threshold, or ` +
        `pass true to the first arg of extractTransaction.`,
    );
  }
}

function checkInputsForPartialSig(inputs: PsbtInput[], action: string): void {
  inputs.forEach(input => {
    const throws = checkInputForSig(input, action);
    if (throws)
      throw new Error('Can not modify transaction, signatures exist.');
  });
}

function checkPartialSigSighashes(input: PsbtInput): void {
  if (!input.sighashType || !input.partialSig) return;
  const { partialSig, sighashType } = input;
  partialSig.forEach((pSig: PartialSig) => {
    const { hashType } = signatureutils.decode(pSig.signature);
    if (sighashType !== hashType) {
      throw new Error('Signature sighash does not match input sighash type');
    }
  });
}

function checkScriptForPubkey(
  pubkey: Uint8Array,
  script: Uint8Array,
  action: string,
): void {
  if (!pubkeyInScript(pubkey, script)) {
    throw new Error(
      `Can not ${action} for this input with the key ${tools.toHex(pubkey)}`,
    );
  }
}

function checkTxEmpty(tx: Transaction): void {
  const isEmpty = tx.inputs.every(
    input =>
      input.script &&
      input.script.length === 0
  );
  if (!isEmpty) {
    throw new Error('Format Error: Transaction ScriptSigs are not empty');
  }
}

function checkTxForDupeIns(tx: Transaction, cache: PsbtCache): void {
  tx.inputs.forEach(input => {
    checkTxInputCache(cache, input);
  });
}

function checkTxInputCache(
  cache: PsbtCache,
  input: Transaction.Input,
): void {
  const key =
    tools.toHex(reverseBuffer(Uint8Array.from(input.prevTxId))) + ':' + input.outputIndex;
  if (cache.__TX_IN_CACHE[key]) throw new Error('Duplicate input detected.');
  cache.__TX_IN_CACHE[key] = 1;
}


type TxCacheNumberKey = '__FEE_RATE' | '__FEE';
function getTxCacheValue<T extends TxCacheNumberKey>(
  key: T,
  name: string,
  inputs: PsbtInput[],
  c: PsbtCache,
): bigint | number | undefined {
  if (!inputs.every(isFinalized))
    throw new Error(`PSBT must be finalized to calculate ${name}`);
  if (key === '__FEE_RATE' && c.__FEE_RATE) return c.__FEE_RATE;
  if (key === '__FEE' && c.__FEE) return c.__FEE;
  let tx: Transaction;
  let mustFinalize = true;
  if (c.__EXTRACTED_TX) {
    tx = c.__EXTRACTED_TX;
    mustFinalize = false;
  } else {
    tx = c.__TX.clone();
  }
  inputFinalizeGetAmts(inputs, tx, c, mustFinalize);
  if (key === '__FEE_RATE') return c.__FEE_RATE!;
  else if (key === '__FEE') return c.__FEE!;

  return undefined;
}

/**
 * This function must do two things:
 * 1. Check if the `input` can be finalized. If it can not be finalized, throw.
 *   ie. `Can not finalize input #${inputIndex}`
 * 2. Create the finalScriptSig and finalScriptWitness Buffers.
 */
export type FinalScriptsFunc = (
  inputIndex: number, // Which input is it?
  input: PsbtInput, // The PSBT input contents
  script: Uint8Array, // The "meaningful" locking script Buffer
) => {
  finalScriptSig: Uint8Array | undefined;
};

function getFinalScripts(
  inputIndex: number,
  input: PsbtInput,
  script: Uint8Array,
): {
  finalScriptSig: Uint8Array | undefined;
} {
  const scriptType = classifyScript(script);
  if (!canFinalize(input, script, scriptType))
    throw new Error(`Can not finalize input #${inputIndex}`);
  return prepareFinalScripts(
    script,
    scriptType,
    input.partialSig!,
  );
}

function prepareFinalScripts(
  script: Uint8Array,
  scriptType: string,
  partialSig: PartialSig[],
): {
  finalScriptSig: Uint8Array | undefined;
} {

  // Wow, the payments API is very handy
  const us: Script = getUnlockingScript(script, scriptType, partialSig);

   const finalScriptSig: Uint8Array = us.toBuffer();
  return {
    finalScriptSig,
  };
}

function getHashAndSighashType(
  inputs: PsbtInput[],
  inputIndex: number,
  cache: PsbtCache,
  sighashTypes: number[],
): {
  hash: Uint8Array;
  sighashType: number;
} {
  const input = checkForInput(inputs, inputIndex);
  const { hash, sighashType } = getHashForSig(
    inputIndex,
    input,
    cache,
    sighashTypes,
  );
  //checkScriptForPubkey(pubkey, script, 'sign');
  return {
    hash,
    sighashType,
  };
}

function getHashForSig(
  inputIndex: number,
  input: PsbtInput,
  cache: PsbtCache,
  sighashTypes?: number[],
): {
  script: Uint8Array;
  hash: Uint8Array;
  sighashType: number;
} {
  const unsignedTx = cache.__TX;
  const sighashType = input.sighashType || crypto.Signature.SIGHASH_ALL;
  checkSighashTypeAllowed(sighashType, sighashTypes);

  const prevout: Transaction.Output = unsignedTx.inputs[inputIndex].output!;

  const { meaningfulScript } = getMeaningfulScript(
    prevout.script.toBuffer(),
  );


  const hash = unsignedTx.hashForSignature(
    inputIndex,
    sighashType,
  );

  return {
    script: meaningfulScript,
    sighashType,
    hash,
  };
}




function checkSighashTypeAllowed(
  sighashType: number,
  sighashTypes?: number[],
): void {
  if (sighashTypes && sighashTypes.indexOf(sighashType) < 0) {
    const str = sighashTypeToString(sighashType);
    throw new Error(
      `Sighash type is not allowed. Retry the sign method passing the ` +
        `sighashTypes array of whitelisted types. Sighash type: ${str}`,
    );
  }
}

function getUnlockingScript(
  script: Uint8Array,
  scriptType: string,
  partialSig: PartialSig[],
): Script {
  let unlockingScript: Script;
  switch (scriptType) {
    case 'multisig':
    { 
        const sigs = getSortedSigs(script, partialSig);
        unlockingScript = Script.fromASM(`OP_0 ${sigs.map(sig => tools.toHex(sig)).join(' ')}`);
        break; 
    }
    case 'pubkey':
      {
        const ls = Script.fromBuffer(Buffer.from(script));

        if(ls.isPublicKeyOut()) {
          unlockingScript = Script.fromASM(
            `${tools.toHex(partialSig[0].signature)}}`,
          );
        } else {
          throw new Error(
            'Can not finalize pubkey script, it is not a valid public key script',
          );
        }
        break;
      }
    case 'pubkeyhash':
      {
        const ls = Script.fromBuffer(Buffer.from(script));

        if(ls.isPublicKeyHashOut()) {
          unlockingScript = Script.fromASM(
            `${tools.toHex(partialSig[0].signature)} ${tools.toHex(partialSig[0].pubkey)}`,
          );
        } else {
          throw new Error(
            'Can not finalize pubkey script, it is not a valid public key hash script',
          );
        }
        break;
      }
  }
  return unlockingScript!;
}

interface GetScriptReturn {
  script: Uint8Array | null;
}
function getScriptFromInput(
  _inputIndex: number,
  input: PsbtInput,
  _cache: PsbtCache,
): GetScriptReturn {
  const res: GetScriptReturn = {
    script: null,
  };

  res.script = input.opcatUtxo.script
  return res;
}

function getSignersFromHD(
  inputIndex: number,
  inputs: PsbtInput[],
  hdKeyPair: HDSigner | HDSignerAsync,
): Array<Signer | SignerAsync> {
  const input = checkForInput(inputs, inputIndex);
  if (!input.bip32Derivation || input.bip32Derivation.length === 0) {
    throw new Error('Need bip32Derivation to sign with HD');
  }
  const myDerivations = input.bip32Derivation
    .map((bipDv: Bip32Derivation) => {
      if (tools.compare(bipDv.masterFingerprint, hdKeyPair.fingerprint) === 0) {
        return bipDv;
      } else {
        return undefined;
      }
    })
    .filter((v: Bip32Derivation | undefined) => !!v) as Bip32Derivation[];
  if (myDerivations.length === 0) {
    throw new Error(
      'Need one bip32Derivation masterFingerprint to match the HDSigner fingerprint',
    );
  }
  const signers: Array<Signer | SignerAsync> = myDerivations.map(bipDv => {
    const node = hdKeyPair.derivePath(bipDv!.path);
    if (tools.compare(bipDv!.pubkey, node.publicKey) !== 0) {
      throw new Error('pubkey did not match bip32Derivation');
    }
    return node;
  });
  return signers;
}

function getSortedSigs(
  script: Uint8Array,
  partialSig: PartialSig[],
): Uint8Array[] {
  const ss = Script.fromBuffer(Buffer.from(script));
  const p2ms = ss.decodeMultisigOut();
  // for each pubkey in order of p2ms script
  return p2ms
    .pubkeys!.map(pk => {
      // filter partialSig array by pubkey being equal
      return (
        partialSig.filter(ps => {
          return tools.compare(ps.pubkey, pk) === 0;
        })[0] || {}
      ).signature;
      // Any pubkey without a match will return undefined
      // this last filter removes all the undefined items in the array.
    })
    .filter(v => !!v);
}


function sighashTypeToString(sighashType: number): string {
  let text =
    sighashType & crypto.Signature.SIGHASH_ANYONECANPAY
      ? 'SIGHASH_ANYONECANPAY | '
      : '';
  const sigMod = sighashType & 0x1f;
  switch (sigMod) {
    case crypto.Signature.SIGHASH_ALL:
      text += 'SIGHASH_ALL';
      break;
    case crypto.Signature.SIGHASH_SINGLE:
      text += 'SIGHASH_SINGLE';
      break;
    case crypto.Signature.SIGHASH_NONE:
      text += 'SIGHASH_NONE';
      break;
  }
  return text;
}

function inputFinalizeGetAmts(
  inputs: PsbtInput[],
  tx: Transaction,
  cache: PsbtCache,
  mustFinalize: boolean,
): void {
  let inputAmount = 0n;
  inputs.forEach((input, idx) => {
    if (mustFinalize && input.finalScriptSig)
      tx.inputs[idx].setScript(Script.fromBuffer(Buffer.from(input.finalScriptSig)))

      const out = tx.inputs[idx].output!;
      inputAmount += BigInt(out.satoshis);
  });
  const outputAmount = (tx.outputs as Transaction.Output[]).reduce(
    (total, o) => total + BigInt(o.satoshis),
    0n,
  );
  const fee = inputAmount - outputAmount;
  if (fee < 0) {
    throw new Error('Outputs are spending more than Inputs');
  }
  const bytes = tx.getEstimateSize();
  cache.__FEE = fee;
  cache.__EXTRACTED_TX = tx;
  cache.__FEE_RATE = Math.floor(Number(fee / BigInt(bytes)));
}


function getScriptFromUtxo(
  inputIndex: number,
  input: PsbtInput,
  cache: PsbtCache,
): Uint8Array {
  const { script } = getScriptAndAmountFromUtxo(inputIndex, input, cache);
  return script;
}

function getScriptAndAmountFromUtxo(
  inputIndex: number,
  _input: PsbtInput,
  cache: PsbtCache,
): { script: Uint8Array; value: bigint, data: Uint8Array } {
  const unsignedTx = cache.__TX;
  const o = unsignedTx.inputs[inputIndex].output;
    return { script: o.script.toBuffer(), value: BigInt(o.satoshis), data: o.data };
}

function pubkeyInInput(
  pubkey: Uint8Array,
  input: PsbtInput,
  inputIndex: number,
  cache: PsbtCache,
): boolean {
  const script = getScriptFromUtxo(inputIndex, input, cache);
  const { meaningfulScript } = getMeaningfulScript(
    script,
  );
  return pubkeyInScript(pubkey, meaningfulScript);
}

function pubkeyInOutput(
  pubkey: Uint8Array,
  outputIndex: number,
  cache: PsbtCache,
): boolean {
  const script = cache.__TX.outputs[outputIndex].script;
  const { meaningfulScript } = getMeaningfulScript(
    script.toBuffer(),
  );
  return pubkeyInScript(pubkey, meaningfulScript);
}

function compressPubkey(pubkey: Uint8Array): Uint8Array {
  if (pubkey.length === 65) {
    const parity = pubkey[64] & 1;
    const newKey = pubkey.slice(0, 33);
    newKey[0] = 2 | parity;
    return newKey;
  }
  return pubkey.slice();
}

function getMeaningfulScript(
  script: Uint8Array,
): {
  meaningfulScript: Uint8Array;
  type:  'raw';
} {
  return {
    meaningfulScript: script,
    type: 'raw',
  };
}


type AllScriptType =
  | 'pubkeyhash'
  | 'multisig'
  | 'pubkey'
  | 'nonstandard';
type ScriptType =
  | 'pubkeyhash'
  | 'multisig'
  | 'pubkey'
  | 'nonstandard';
function classifyScript(script: Uint8Array): ScriptType {
  const _script = Script.fromBuffer(Buffer.from(script));
  if (_script.isPublicKeyHashOut()) return 'pubkeyhash';
  if (_script.isMultisigOut()) return 'multisig';
  if (_script.isPublicKeyOut) return 'pubkey';
  return 'nonstandard';
}

function range(n: number): number[] {
  return [...Array(n).keys()];
}


function txFromBitcoinBuffer(buf: Buffer): Transaction {
  const inputFromBufferReader = (reader: encoding.BufferReader) => {
    const prevTxId = reader.readReverse(32);
    const outputIndex = reader.readUInt32LE();
    const script = reader.readVarLengthBuffer();
    const sequenceNumber = reader.readUInt32LE();
    const input = new Transaction.Input({
      prevTxId,
      outputIndex,
      script,
      sequenceNumber
    });
    return input;
  }
  const outputFromBufferReader = (reader: encoding.BufferReader) => {
    const satoshis = reader.readUInt64LEBN() as any;
    const script = reader.readVarLengthBuffer();
    const output = new Transaction.Output({
      satoshis,
      script,
      data: Buffer.from([])
    });
    return output;
  }

  const tx = new Transaction();
  const reader = new encoding.BufferReader(buf);
  tx.version = reader.readUInt32LE();
  const inputCount = reader.readVarintNum();
  for (let i = 0; i < inputCount; i++) {
    tx.inputs.push(inputFromBufferReader(reader));
  }
  const outputCount = reader.readVarintNum();
  for (let i = 0; i < outputCount; i++) {
    // console.log('output', i, outputCount)
    tx.outputs.push(outputFromBufferReader(reader));
  }
  const nLockTime = reader.readUInt32LE();
  tx.nLockTime = nLockTime;
  return tx;
}

function txToBitcoinBuffer(tx: Transaction): Buffer {
  const writer = new encoding.BufferWriter();
  writer.writeUInt32LE(tx.version);
  writer.writeVarintNum(tx.inputs.length);
  tx.inputs.forEach(input => {
    writer.writeReverse(input.prevTxId)
    writer.writeUInt32LE(input.outputIndex)
    writer.writeVarintNum(input.script.toBuffer().length)
    writer.write(input.script.toBuffer())
    writer.writeUInt32LE(input.sequenceNumber)
  })
  writer.writeVarintNum(tx.outputs.length);
  tx.outputs.forEach(output => {
    writer.write(Buffer.from(intToByteString(output.satoshis, 8n), 'hex'));
    writer.writeVarintNum(output.script.toBuffer().length)
    writer.write(output.script.toBuffer())
  })
  writer.writeUInt32LE(tx.nLockTime);

  const buf = writer.toBuffer()
  return buf
}