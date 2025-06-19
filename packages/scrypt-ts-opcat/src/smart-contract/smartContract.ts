import { AbstractContract } from './abstractContract.js';
import { Artifact } from './types/artifact.js';
import { buildChangeOutputImpl, buildStateOutputImpl } from './methods/buildOutput.js';
import { checkCtxImpl } from './methods/checkCtx.js';
import { checkSHPreimageImpl as checkSHPreimageImpl } from './methods/checkSHPreimage.js';
import { checkSigImpl } from './methods/checkSig.js';
import { ByteString, PubKey, SHPreimage, Sig } from './types/index.js';
import { ABICoder, Arguments } from './abi.js';
import { Script } from './types/script.js';
import { ExtUtxo, InputIndex, Optional, RawArgs, UTXO } from '../globalTypes.js';
import { uint8ArrayToHex, cloneDeep, isFinal } from '../utils/index.js';
import { Contextual, InputContext, IContext } from './types/context.js';
import {
  Int32,
  SigHashType,
  OpcatState,
  SupportedParamType,
} from './types/primitives.js';
import { hash256, sha256 } from './fns/hashes.js';
import { slice } from './fns/byteString.js';
import { checkInputStateImpl } from './methods/checkInputState.js';
import { deserializeOutputs } from './serializer.js';
import { BacktraceInfo } from './types/structs.js';
import { backtraceToOutpointImpl, backtraceToScriptImpl } from './methods/backtraceToGenensis.js';
import { serializeState } from './stateSerializer.js';
import { OpCode } from './types/opCode.js';
import { getUnRenamedSymbol } from './abiutils.js';
import { checkInputStateHashesImpl } from './methods/checkInputStateHashes.js';



/**
 * Used to invoke public methods of a contract, corresponding to the witness of a Taproot input
 */
interface MethodCallData {
  method: string;
  args: SupportedParamType[];
  rawArgs: RawArgs;
}

/**
 * The main contract class. To write a contract, extend this class as such:
 * @onchain
 * @example
 *  ```ts
 * class YourSmartContract extends SmartContract {
 *   // your smart contract code here
 * }
 * ```
 * @category SmartContract
 */
export class SmartContract<StateT extends OpcatState = undefined>
  extends AbstractContract
{
  /**
   * Bitcoin Contract Artifact
   */
  public static artifact: Artifact;
  private static newFromCreate: boolean = false;

  /**
   *
   * @ignore
   */
  static stateType?: string;

  /**
   *
   * @ignore
   */
  getStateType(): string | undefined {
    const clazz = this.constructor as typeof SmartContract;
    return clazz.stateType;
  }

  utxo?: UTXO;

  /**
   * The state of the contract UTXO, usually committed to the first OP_RETURN output, is revealed when spending.
   * @onchain
   */
  state: StateT;

  /**
   * Locking script corresponding to the SmartContract
   */
  readonly lockingScript: Script;

  /**
   * This function is usually called on the frontend.
   * The contract class needs to call this function before instantiating.
   * @param artifact a contract artifact json object
   */
  static loadArtifact(artifact: Artifact) {
    if (getUnRenamedSymbol(artifact.contract) !== getUnRenamedSymbol(this.name)) {
      throw new Error(`Artifact does not match contract ${this.name}!`);
    }
    this.artifact = artifact;
    this.stateType = artifact.stateType;
    return this;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(...args: SupportedParamType[]) {
    super();
    const ContractClazz = this.constructor as typeof SmartContract;
    if (!ContractClazz.artifact) {
      throw new Error(`Artifact not loaded for contract ${this.constructor.name}!`);
    }

    const artifact = ContractClazz.artifact;
    this._abiCoder = new ABICoder(artifact);

    if (Object.getPrototypeOf(this.constructor.prototype) !== SmartContract.prototype) {
      // contract is not a direct child of SmartContract, should use ContractClazz.create instead
      if (!SmartContract.newFromCreate) {
        throw new Error(
          `Contract \`${this.constructor.name}\` is not a direct child of \`SmartContract\`, should use \`${this.constructor.name}.create\` instead of use \`new ${this.constructor.name}\``,
        );
      }
    }
    if (!SmartContract.newFromCreate) {
      this.generateLockingScript(...args);
    }
  }

    /**
   * @ignore
   * @param args
   */
  private generateLockingScript(...args: SupportedParamType[]) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (this as any).lockingScript = this._abiCoder.encodeConstructorCall(args);
  }

  /**
   * Used to create an instance of a smart contract. If your smart contract has a base class, you must use this method to instantiate it.
   * @param this
   * @param args
   * @returns
   */
  static create<T extends { new (...args: ConstructorParameters<T>): InstanceType<T> }>(
    this: T,
    ...args: ConstructorParameters<T>
  ) {
    SmartContract.newFromCreate = true;
    const instance = new this(...args);
    SmartContract.newFromCreate = false;
    (instance as SmartContract).generateLockingScript(...(args as SupportedParamType[]));
    return instance;
  }

  /**
   * Using the [OP_PUSH_TX]{@link https://medium.com/@xiaohuiliu/op-push-tx-3d3d279174c1} technique, check if `shPreimage` is the preimage of the current transaction.
   * @onchain
   * @param txPreimage The format of the preimage is [specified]{@link https://github.com/bitcoin/bips/blob/master/bip-0341.mediawiki#signature-validation-rules}
   * @returns true if `shPreimage` is the preimage of the current transaction. Otherwise false.
   */
  checkSHPreimage(shPreimage: SHPreimage): boolean {
    return checkSHPreimageImpl(this, shPreimage);
  }

  /**
   * A built-in function verifies an Schnorr signature. It takes two inputs from the stack, a public key (on top of the stack) and an Schnorr signature in its DER_CANONISED format concatenated with sighash flags.
   * It outputs true or false on the stack based on whether the signature check passes or fails. [see]{@link https://github.com/bitcoin/bips/blob/master/bip-0341.mediawiki#specification}
   * @onchain
   * @category Signature Verification
   */
  checkSig(
    signature: Sig,
    publickey: PubKey,
    errorMsg: string = 'signature check failed',
  ): boolean {
    const fSuccess = checkSigImpl(this, signature, publickey);
    if (!fSuccess && signature.length) {
      // because NULLFAIL rule, always throw if catch a wrong signature
      // https://github.com/bitcoin/bips/blob/master/bip-0146.mediawiki#nullfail
      throw new Error(errorMsg);
    }
    return fSuccess;
  }

  /**
   * A built-in function to create an [change output]{@link https://en.bitcoin.it/wiki/Change}.
   * @onchain
   * @returns
   */
  buildChangeOutput(): ByteString {
    this._checkPsbtBinding();
    return buildChangeOutputImpl(this._curPsbt);
  }

  /**
   * @ignore
   */
  get accessedInputStateProofs(): boolean {
    return (
      this._abiCoder.artifact.abi.filter(
        (func) => func.params.filter((p) => p.name === '__scrypt_ts_inputStateProofs').length > 0,
      ).length > 0
    );
  }

  /**
   * A built-in function to create all outputs  added by `appendStateOutput()`
   * @onchain
   * @returns an output containing the new state
   */
  buildStateOutput(satoshis: Int32): ByteString {
    this._checkPsbtBinding();
    return buildStateOutputImpl(this, this.state, satoshis, this.ctx.spentScriptHash);
  }

  /**
   * Calculate the hash of all states of the current contract
   * @onchain
   * @param state state of the contract
   * @returns hash160 of the state
   */
  static override serializeState<T extends OpcatState>(
    this: { new (...args: unknown[]): SmartContract<T> },
    state: T,
  ): ByteString {
    const selfClazz = this as typeof SmartContract;

    const artifact = selfClazz.artifact;
    if (!artifact) {
      throw new Error(`Artifact is not loaded for the contract: ${this.name}`);
    }

    const stateType = selfClazz.stateType;
    if (!stateType) {
      throw new Error(`State struct \`${stateType}\` is not defined!`);
    }

    return serializeState(artifact, stateType, state);
  }

  /**
   * check StateHash of the input. By default, the system checks the StateHash of all inputs.
   * If you use this function to specify checking only specific inputs' StateHash, you must set the `autoCheckInputState`
   * option in the `@method()` decorator to false.
   * @onchain
   * @param inputIndex index of the input
   * @param stateData the state data of the input
   * @returns success if stateData is valid
   */
  override checkInputState(inputIndex: Int32, stateData: ByteString): boolean {
    const stateHash = slice(this.inputContext.spentDataHashes, inputIndex * 32n, (inputIndex +  1n) * 32n);
    checkInputStateImpl(
      stateHash,
      stateData
    );
    return true;
  }

  /**
   * The current Extended PSBT object that is spending this contract instance.
   */
  private _curPsbt?: Contextual;

  /**
   * The input index in the current Extended PSBT object that is spending this contract instance.
   */
  private _curInputIndex?: InputIndex;

  /**
   * Get the context details of the current PSBT input in which this contract is called or spent.
   * @onchain
   */
  get ctx(): IContext {
    const {
      shPreimage,
      inputCount,
      prevouts,
      prevout,
      spentScriptHashes,
      spentAmounts,
      spentDataHashes,
    } = this.inputContext;
    return {
      ...shPreimage,
      inputCount,
      prevouts,
      prevout,
      spentScriptHashes,
      spentAmounts,
      spentDataHashes,
    };
  }

  /**
   * Mark the contract instance as spent from the input of the PSBT.
   * @param psbt
   * @param inputIndex
   */
  spentFromInput(psbt: Contextual, inputIndex: number) {
    this._curPsbt = psbt;
    this._curInputIndex = inputIndex;
  }

  get spentPsbt(): Contextual | undefined {
    return this._curPsbt;
  }

  setSighashType(sigHashType: SigHashType) {
    this._checkPsbtBinding();
    this._curPsbt.setSighashType(this._curInputIndex, sigHashType);
  }

  /**
   * Get the context of the current PSBT input in which this contract is called or spent.
   * @returns the context of the current PSBT input
   */
  get inputContext(): InputContext {
    this._checkPsbtBinding();
    return this._curPsbt.getInputCtx(this._curInputIndex);
  }

  private _abiCoder: ABICoder;

  private _methodCall?: MethodCallData;

  /**
   *
   * @ignore
   */
  extendMethodArgs(method: string, args: SupportedParamType[], autoCheckInputState: boolean) {
    // extend the args with the context
    if (this._shouldInjectCtx(method)) {
      this._autoInject(method, args, autoCheckInputState);
    }

    const rawArgs = this._abiCoder.encodePubFunctionCall(method, args);

    this._methodCall = {
      method,
      args,
      rawArgs,
    };
  }

  /**
   *
   * @ignore
   */
  isPubFunction(method: string): boolean {
    return this._abiCoder.isPubFunction(method);
  }

  isSmartContract(): boolean {
    return true;
  }

  private _shouldInjectCtx(method: string): boolean {
    return this._abiCoder.artifact.abi.some((abiEntity) => {
      return (
        abiEntity.name === method &&
        abiEntity.params.some((param) => param.name === '__scrypt_ts_shPreimage')
      );
    });
  }

  private _autoInject(
    method: string,
    args: SupportedParamType[],
    autoCheckInputState: boolean,
  ) {
    const {
      shPreimage,
      prevouts,
      prevout,
      spentScriptHashes,
      spentAmounts,
      spentDataHashes,
      inputCount,
    } = this.inputContext;

    checkCtxImpl(
      this,
      shPreimage,
      this._curInputIndex,
      prevouts,
      prevout,
      spentScriptHashes,
      spentAmounts,
      spentDataHashes,
    );

    const curState = this.state;

    const abiEntity = this._abiCoder.artifact.abi.find((abiEntity) => {
      return abiEntity.name === method;
    });

    if (abiEntity) {
      abiEntity.params.forEach((param) => {
        if (param.name === '__scrypt_ts_shPreimage') {
          const { shPreimage } = this.inputContext;
          args.push(shPreimage);
        } else if (param.name === '__scrypt_ts_changeInfo') {
          args.push(this.changeInfo);
        } else if (param.name === '__scrypt_ts_prevouts') {
          args.push(prevouts);
        } else if (param.name === '__scrypt_ts_prevout') {
          args.push(prevout);
        } else if (param.name === '__scrypt_ts_spentScriptHashes') {
          const { spentScriptHashes } = this.inputContext;
          args.push(spentScriptHashes);
        } else if (param.name === '__scrypt_ts_spentAmounts') {
          args.push(spentAmounts);
        } else if (param.name === '__scrypt_ts_spentScript') {
          args.push(this.lockingScript.toHex());
        } else if (param.name === '__scrypt_ts_stateHashes') {
          checkInputStateHashesImpl(Number(inputCount), shPreimage.hashSpentDataHashes, spentDataHashes)
          args.push(spentDataHashes);
        } else if (param.name === '__scrypt_ts_curState') {
          this._checkState();
          if (autoCheckInputState) {
            checkInputStateImpl(
              shPreimage.spentDataHash,
              (this.constructor as typeof SmartContract<OpcatState>).serializeState(curState),
            );
          }
          args.push(curState);
        }
      });
    }
  }

  private _checkPsbtBinding() {
    if (this._curPsbt === undefined || this._curInputIndex === undefined) {
      throw new Error('Not binding to any PSBT input!');
    }
  }

  private _checkState() {
    if (this.state === undefined) {
      throw new Error('State is not initialized!');
    }
  }

  /**
   * Get the change info of the change output for current psbt.
   * @onchain
   * @returns the change info of current psbt
   */
  get changeInfo() {
    this._checkPsbtBinding();
    return this._curPsbt.getChangeInfo();
  }

  /**
   * A set of functions for debugging contracts, which can only be called in `@method` methods.
   * @onchain
   */
  get debug() {
    return {
      diffOutputs: (outputsByte: ByteString) => {
        const outputs = deserializeOutputs(outputsByte);

        if (outputs.length !== this._curPsbt?.txOutputs.length) {
          console.warn(
            `Outputs count is different: ${outputs.length}(#contract) vs ${this._curPsbt?.txOutputs.length}(#context)`,
          );
          return;
        }

        this._curPsbt?.txOutputs.forEach((output, index) => {
          const scriptHash = sha256(uint8ArrayToHex(output.script));
          const dataHash = sha256(uint8ArrayToHex(output.data));
          if (outputs[index].dataHash !== dataHash) {
            console.warn(
              `Output[${index}] dataHash is different: ${outputs[index]?.dataHash}(#contract) vs ${dataHash}(#context)`,
            );
          }
          if (outputs[index].scriptHash !== scriptHash) {
            console.warn(
              `Output[${index}] scriptHash is different: ${outputs[index]?.scriptHash}(#contract) vs ${scriptHash}(#context)`,
            );
          }
          if (outputs[index]?.value !== output.value) {
            console.warn(
              `Output[${index}] value is different: ${outputs[index]?.value}(#contract) vs ${output.value}(#context)`,
            );
          }
        });
      },
    };
  }

  /**
   * Check the outputs with the context of current transaction.
   * @param outputs the expected serialized outputs of the current transaction
   * @returns true if the outputs are not consistent with the transaction context, otherwise false.
   * @onchain
   */
  override checkOutputs(outputs: ByteString): boolean {
    if (this.ctx.hashOutputs !== hash256(outputs)) {
      this.debug.diffOutputs(outputs);
      return false;
    }
    return true;
  }


  /**
   * Returns the raw arguments from the call data of the smart contract.
   * @returns The raw arguments extracted from the call data.
   */
  getRawArgsOfCallData(): RawArgs {
    return this.getCallData().rawArgs;
  }


  /**
   * Gets the method call data for the current smart contract.
   * @throws {Error} If no method call is found.
   * @returns {MethodCallData} The method call data object.
   */
  getCallData(): MethodCallData {
    if (!this._methodCall) {
      throw new Error('No method call found!');
    }
    return this._methodCall;
  }

  /**
   * Transform raw arguments from the testimony into arguments previously used to invoke the contract.
   * @ignore
   * @param _args
   * @param _method
   */
  rawArgsToCallData(_args: RawArgs, _method: string): Arguments {
    throw new Error('Method not implemented.');
  }

  /**
   * Checks a locktime parameter with the transaction's locktime.
   * There are two times of nLockTime: lock-by-blockheight and lock-by-blocktime,
   * distinguished by whether nLockTime < LOCKTIME_THRESHOLD = 500000000
   *
   * See the corresponding code on bitcoin core:
   * https://github.com/bitcoin/bitcoin/blob/ffd75adce01a78b3461b3ff05bcc2b530a9ce994/src/script/interpreter.cpp#L1129
   *
   * See the bip65 for specification
   * https://github.com/bitcoin/bips/blob/master/bip-0065.mediawiki#summary
   * @onchain
   * @param {BN} nLockTime the locktime read from the script
   * @return {boolean} true if the transaction's locktime is less than or equal to
   *                   the transaction's locktime
   */
  absTimeLock(nLockTime: Int32): boolean {
    // We want to compare apples to apples, so fail the script
    // unless the type of nLockTime being tested is the same as
    // the nLockTime in the transaction.

    const locktime = this._curPsbt!.getlockTime();
    const LOCKTIME_THRESHOLD = 500000000;
    const LOCKTIME_THRESHOLD_BN = BigInt(LOCKTIME_THRESHOLD);
    if (
      !(
        (locktime < LOCKTIME_THRESHOLD && nLockTime < LOCKTIME_THRESHOLD_BN) ||
        (locktime >= LOCKTIME_THRESHOLD && nLockTime >= LOCKTIME_THRESHOLD_BN)
      )
    ) {
      return false;
    }

    // Now that we know we're comparing apples-to-apples, the
    // comparison is a simple numeric one.
    if (nLockTime > BigInt(locktime)) {
      return false;
    }

    // Finally the nLockTime feature can be disabled and thus
    // CHECKLOCKTIMEVERIFY bypassed if every txin has been
    // finalized by setting nSequence to maxint. The
    // transaction would be allowed into the blockchain, making
    // the opcode ineffective.
    //
    // Testing if this vin is not final is sufficient to
    // prevent this condition. Alternatively we could test all
    // inputs, but testing just this input minimizes the data
    // required to prove correct CHECKLOCKTIMEVERIFY execution.

    const sequence = this._curPsbt!.getSequence(this._curInputIndex!);
    if (!isFinal(sequence)) {
      return false;
    }

    return true;
  }

  /**
   * Checks a sequence parameter with the transaction's sequence.
   * @onchain
   * @param {BN} nSequence the sequence read from the script
   * @return {boolean} true if the transaction's sequence is less than or equal to
   *                   the transaction's sequence
   */
  relTimeLock(nSequence: Int32): boolean {
    // Relative lock times are supported by comparing the passed in operand to
    // the sequence number of the input.
    const txToSequence = this._curPsbt!.getSequence(this._curInputIndex!);

    // Fail if the transaction's version number is not set high enough to
    // trigger BIP 68 rules.
    // if (this.tx.version < 2) {
    //   return false;
    // }

    // Sequence numbers with their most significant bit set are not consensus
    // constrained. Testing that the transaction's sequence number do not have
    // this bit set prevents using this property to get around a
    // CHECKSEQUENCEVERIFY check.
    // if (txToSequence & Interpreter.SEQUENCE_LOCKTIME_DISABLE_FLAG) {
    //   return false;
    // }

    /**
     * If CTxIn::nSequence encodes a relative lock-time and this flag is set,
     * the relative lock-time has units of 512 seconds, otherwise it specifies
     * blocks with a granularity of 1.
     */
    const SEQUENCE_LOCKTIME_TYPE_FLAG = 1 << 22;

    /**
     * If CTxIn::nSequence encodes a relative lock-time, this mask is applied to
     * extract that lock-time from the sequence field.
     */
    const SEQUENCE_LOCKTIME_MASK = 0x0000ffff;

    // Mask off any bits that do not have consensus-enforced meaning before
    // doing the integer comparisons
    const nLockTimeMask = SEQUENCE_LOCKTIME_TYPE_FLAG | SEQUENCE_LOCKTIME_MASK;
    const txToSequenceMasked = BigInt(txToSequence & nLockTimeMask);
    const nSequenceMasked = nSequence & BigInt(nLockTimeMask);

    // There are two kinds of nSequence: lock-by-blockheight and
    // lock-by-blocktime, distinguished by whether nSequenceMasked <
    // CTxIn::SEQUENCE_LOCKTIME_TYPE_FLAG.
    //
    // We want to compare apples to apples, so fail the script unless the type
    // of nSequenceMasked being tested is the same as the nSequenceMasked in the
    // transaction.
    const SEQUENCE_LOCKTIME_TYPE_FLAG_BN = BigInt(SEQUENCE_LOCKTIME_TYPE_FLAG);

    if (
      !(
        (txToSequenceMasked < SEQUENCE_LOCKTIME_TYPE_FLAG_BN &&
          nSequenceMasked < SEQUENCE_LOCKTIME_TYPE_FLAG_BN) ||
        (txToSequenceMasked >= SEQUENCE_LOCKTIME_TYPE_FLAG_BN &&
          nSequenceMasked >= SEQUENCE_LOCKTIME_TYPE_FLAG_BN)
      )
    ) {
      return false;
    }

    // Now that we know we're comparing apples-to-apples, the comparison is a
    // simple numeric one.
    return nSequenceMasked <= txToSequenceMasked;
  }

  /**
   * Check whether the contract can be traced back to the genesis outpoint.
   * @param backtraceInfo the backtrace info to verify, including prevTx and prevPrevTx informations
   * @param genesisOutpoint expected genesis outpoint to be traced back to
   * @returns true if the contract can be backtraced to the genesis outpoint. Otherwise false.
   * @onchain
   * @category Backtrace
   */
  override backtraceToOutpoint(backtraceInfo: BacktraceInfo, genesisOutpoint: ByteString): boolean {
    return backtraceToOutpointImpl(this, backtraceInfo, genesisOutpoint);
  }

  /**
   * Check whether the contract can be traced back to the genesis script.
   * @param backtraceInfo the backtrace info to verify, including prevTx and prevPrevTx informations
   * @param genesisScript expected genesis script to be traced back to
   * @returns true if the contract can be backtraced to the genesis script. Otherwise false.
   * @onchain
   * @category Backtrace
   */
  override backtraceToScript(backtraceInfo: BacktraceInfo, genesisScript: ByteString): boolean {
    return backtraceToScriptImpl(this, backtraceInfo, genesisScript);
  }


  /**
   * Get a new contract instance with the new state.
   * @param newState the new state
   * @returns the new covenant
   */
  next(newState: StateT): this {
    const next = cloneDeep(this);
    next.state = newState;
    next.utxo = undefined;
    return next;
  }


  /**
   * Binds the smart contract to a UTXO by verifying and setting its script.
   * @param utxo - The UTXO to bind to (script field is optional)
   * @returns The contract instance for chaining
   * @throws Error if the UTXO's script exists and doesn't match the contract's locking script
   */
  bindToUtxo(utxo: Optional<ExtUtxo, 'script'> | Optional<UTXO, 'script'>): this {
    if (utxo.script && this.lockingScript.toHex() !== utxo.script) {
      throw new Error(
        `Different script, can not bind contract '${this.constructor.name}' to this UTXO: ${JSON.stringify(utxo)}!`,
      );
    }

    this.utxo = { ...utxo, script: this.lockingScript.toHex() };
    return this;
  }

  /**
   * Checks if the contract has state by verifying if the state object exists and is not empty.
   * @returns {boolean} True if the contract has state, false otherwise.
   */
  isStateful(): boolean {
    return this.state && Object.keys(this.state).length > 0
  }
}
