import { AbstractContract } from './abstractContract.js';
import { Artifact } from './types/artifact.js';
import { buildChangeOutputImpl, buildStateOutputsImpl } from './methods/buildOutput.js';
import { checkCtxImpl } from './methods/checkCtx.js';
import { checkSHPreimageImpl as checkSHPreimageImpl } from './methods/checkSHPreimage.js';
import { checkSigImpl } from './methods/checkSig.js';
import { ByteString, PubKey, SHPreimage, Sig } from './types/index.js';
import { ABICoder, Arguments } from './abi.js';
import { Script } from './types/script.js';
import { Tap } from '@cmdcode/tapscript'; // Requires node >= 19
import { TAPROOT_ONLY_SCRIPT_SPENT_KEY } from './consts.js';
import { InputIndex, TapScript, Taprootable, Witness } from '../globalTypes.js';
import { hexToUint8Array, textToHex, uint8ArrayToHex, calcArtifactHexMD5 } from '../utils/index.js';
import { Contextual, InputContext, IContext } from './types/context.js';
import {
  Int32,
  Ripemd160,
  SigHashType,
  StructObject,
  SupportedParamType,
} from './types/primitives.js';
import { isFinal } from '@scrypt-inc/bitcoinjs-lib';
import { hash160, sha256 } from './fns/hashes.js';
import { int32ToByteString, len, toByteString } from './fns/byteString.js';
import { checkInputStateHashImpl } from './methods/checkInputStateHash.js';
import { deserializeOutputs } from './serializer.js';
import { BacktraceInfo } from './types/structs.js';
import { backtraceToOutpointImpl, backtraceToScriptImpl } from './methods/backtraceToGenensis.js';
import { calculateStateHash } from '../utils/stateHash.js';
import { OpCode } from './types/opCode.js';
import { getUnRenamedSymbol } from './abiutils.js';

/**
 * Used to invoke public methods of a contract, corresponding to the witness of a Taproot input
 */
interface MethodCallData {
  method: string;
  args: SupportedParamType[];
  witness: Witness;
}

interface StateVars {
  /**
   * The count of state outputs appended to the contract.
   */
  stateCount: Int32;

  /**
   * Serialized outputs representing the state of the contract.
   */
  stateOutputs: ByteString;

  /**
   * Concatenated hash roots of the state outputs.
   */
  stateRoots: ByteString;
}

const cblockCache: Record<string, string> = {};

const tapScriptCache: Record<string, string> = {};

const getCblock = function (target, tapTree): string {
  const k = `${target.toString()}${JSON.stringify(tapTree)}`;
  if (!cblockCache[k]) {
    const [, cBlock] = Tap.getPubKey(TAPROOT_ONLY_SCRIPT_SPENT_KEY, {
      target: target,
      tree: tapTree,
    });
    cblockCache[k] = cBlock;
  }
  return cblockCache[k];
};

const encodeScript = function (script: Script): string {
  const k = script.toString();
  if (!tapScriptCache[k]) {
    tapScriptCache[k] = Tap.encodeScript(script);
  }
  return tapScriptCache[k];
};

/**
 * Prepend the locking script with a tag and a md5 hash of the artifact hex.
 *
 * OP_FALSE
 * OP_IF
 *  OP_PUSH <tag>
 *  OP_PUSH 1
 *  OP_PUSH <md5>
 * OP_ENDIF
 *
 *
 * @param lockingScript The locking script to prepend.
 * @param artifact The artifact to prepend.
 * @returns The new locking script.
 */
export function prependLockingScript(lockingScript: Script, artifact: Artifact): Script {
  const tag = textToHex('scr');
  const md5 = calcArtifactHexMD5(artifact.hex);
  const version = OpCode.OP_1;

  const prependScripts = [
    OpCode.OP_FALSE,
    OpCode.OP_IF,
    int32ToByteString(len(tag)),
    tag,
    version,
    int32ToByteString(len(md5)),
    md5,
    OpCode.OP_ENDIF,
  ];
  const newLockingScript = Script.fromHex(prependScripts.join('') + lockingScript.toHex());

  return newLockingScript;
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
export class SmartContract<StateT extends StructObject = undefined>
  extends AbstractContract
  implements Taprootable
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
      this.generateTaproot(...args);
    }
  }

  /**
   * @ignore
   * @param args
   */
  private generateTaproot(...args: SupportedParamType[]) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (this as any).lockingScript = prependLockingScript(
      this._abiCoder.encodeConstructorCall(args),
      this._abiCoder.artifact,
    );
    const [tPubkey, cBlock] = Tap.getPubKey(TAPROOT_ONLY_SCRIPT_SPENT_KEY, {
      target: this.tapScript,
    });

    this.tweakedPubkey = tPubkey;
    this.controlBlock = cBlock;
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
    (instance as SmartContract).generateTaproot(...(args as SupportedParamType[]));
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

  private _stateVars?: StateVars;

  /**
   * A built-in function to append an output with a new stateHash.
   * @onchain
   * @param output the output bytes
   * @param stateHash the hash160 of the contract state
   * @returns state outputs count
   */
  appendStateOutput(output: ByteString, stateHash: Ripemd160): Int32 {
    if (!this._stateVars) {
      this._stateVars = {
        stateCount: 0n,
        stateOutputs: toByteString(''),
        stateRoots: toByteString(''),
      };
    }

    this._stateVars.stateCount += 1n;
    this._stateVars.stateOutputs += output;
    this._stateVars.stateRoots += hash160(stateHash);

    return this._stateVars.stateCount;
  }

  /**
   *
   * @ignore
   */
  clearStateVars() {
    this._stateVars = undefined;
  }

  /**
   * A built-in function to create all outputs  added by `appendStateOutput()`
   * @onchain
   * @returns an output containing the new state
   */
  buildStateOutputs(): ByteString {
    this._checkPsbtBinding();
    return buildStateOutputsImpl(
      this._stateVars?.stateRoots || toByteString(''),
      this._stateVars?.stateCount || 0n,
      this._stateVars?.stateOutputs || toByteString(''),
      this._curPsbt!.getTxoStateHashes(),
    );
  }

  /**
   * Calculate the hash of all states of the current contract
   * @onchain
   * @param state state of the contract
   * @returns hash160 of the state
   */
  static override stateHash<T extends StructObject>(
    this: { new (...args: unknown[]): SmartContract<T> },
    state: T,
  ): Ripemd160 {
    const selfClazz = this as typeof SmartContract;

    const artifact = selfClazz.artifact;
    if (!artifact) {
      throw new Error(`Artifact is not loaded for the contract: ${this.name}`);
    }

    const stateType = selfClazz.stateType;
    if (!stateType) {
      throw new Error(`State struct \`${stateType}\` is not defined!`);
    }

    return calculateStateHash(artifact, stateType, state);
  }

  /**
   * check StateHash of the input. By default, the system checks the StateHash of all inputs.
   * If you use this function to specify checking only specific inputs' StateHash, you must set the `autoCheckInputStateHash`
   * option in the `@method()` decorator to false.
   * @onchain
   * @param inputIndex index of the input
   * @param stateHash stateHash of the input
   * @returns success if stateHash is valid
   */
  override checkInputStateHash(inputIndex: Int32, stateHash: ByteString): boolean {
    checkInputStateHashImpl(
      this.inputContext.inputStateProofs![Number(inputIndex)],
      stateHash,
      this.ctx.prevouts[Number(inputIndex)],
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
      inputIndexVal,
      inputCount,
      prevouts,
      prevout,
      spentScripts,
      spentAmounts,
      inputStateProofs,
      inputStateProof,
      nextStateHashes,
    } = this.inputContext;
    return {
      ...shPreimage,
      inputIndexVal,
      inputCount,
      prevouts,
      prevout,
      spentScripts,
      spentAmounts,
      nextStateHashes,
      inputStateProofs,
      // derived context below
      spentScript: spentScripts[Number(inputIndexVal)],
      spentAmount: spentAmounts[Number(inputIndexVal)],
      inputStateProof,
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

  /**
   * tapScript
   */
  get tapScript(): TapScript {
    return encodeScript(this.lockingScript);
  }

  private _methodCall?: MethodCallData;

  /**
   *
   * @ignore
   */
  extendMethodArgs(method: string, args: SupportedParamType[], autoCheckInputStateHash: boolean) {
    // extend the args with the context
    if (this._shouldInjectCtx(method)) {
      this._autoInject(method, args, autoCheckInputStateHash);
    }

    const argsWitness = this._abiCoder.encodePubFunctionCall(method, args);
    const taprootWitness: Witness = [this.lockingScript, hexToUint8Array(this.controlBlock)];
    const witness = [...argsWitness, ...taprootWitness];

    this._methodCall = {
      method,
      args,
      witness,
    };
  }

  /**
   *
   * @ignore
   */
  isPubFunction(method: string): boolean {
    return this._abiCoder.isPubFunction(method);
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
    autoCheckInputStateHash: boolean,
  ) {
    const {
      shPreimage,
      prevouts,
      prevout,
      spentScripts,
      spentAmounts,
      nextStateHashes,
      inputStateProof,
      inputStateProofs,
    } = this.inputContext;

    checkCtxImpl(
      this,
      shPreimage,
      this._curInputIndex,
      prevouts,
      prevout,
      spentScripts,
      spentAmounts,
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
        } else if (param.name === '__scrypt_ts_inputIndexVal') {
          args.push(BigInt(this._curInputIndex!));
        } else if (param.name === '__scrypt_ts_changeInfo') {
          args.push(this.changeInfo);
        } else if (param.name === '__scrypt_ts_prevouts') {
          args.push(prevouts);
        } else if (param.name === '__scrypt_ts_prevout') {
          args.push(prevout);
        } else if (param.name === '__scrypt_ts_spentScripts') {
          const { spentScripts } = this.inputContext;
          args.push(spentScripts);
        } else if (param.name === '__scrypt_ts_spentAmounts') {
          const { spentAmounts } = this.inputContext;
          args.push(spentAmounts);
        } else if (param.name === '__scrypt_ts_nextStateHashes') {
          // TODO: verify nextStateHashes
          args.push(nextStateHashes);
        } else if (param.name === '__scrypt_ts_curState') {
          this._checkState();
          if (autoCheckInputStateHash) {
            checkInputStateHashImpl(
              inputStateProof,
              (this.constructor as typeof SmartContract<StructObject>).stateHash(curState),
              prevouts[this._curInputIndex],
            );
          }
          args.push(curState);
        } else if (param.name === '__scrypt_ts_inputStateProof') {
          if (!inputStateProof) {
            throw new Error(`missing inputStateProof for auto injection!`);
          }
          args.push(inputStateProof);
        } else if (param.name === '__scrypt_ts_inputStateProofs') {
          if (!inputStateProofs) {
            throw new Error(`missing inputStateProofs for auto injection!`);
          }
          args.push(inputStateProofs);
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
          const script = uint8ArrayToHex(output.script);
          if (outputs[index]?.script !== script) {
            console.warn(
              `Output[${index}] script is different: ${outputs[index]?.script}(#contract) vs ${script}(#context)`,
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
    if (this.ctx.shaOutputs !== sha256(outputs)) {
      this.debug.diffOutputs(outputs);
      return false;
    }
    return true;
  }

  /**
   * get all witness
   * @returns all witness that call the contract
   */

  methodCallToWitness(): Witness {
    if (!this._methodCall) {
      throw new Error('No method call found!');
    }
    return this._methodCall.witness;
  }

  /**
   * Transform witness testimony into arguments previously used to invoke the contract.
   * @ignore
   * @param _witness
   * @param _method
   */
  witnessToContractCallArgs(_witness: Witness, _method: string): Arguments {
    throw new Error('Method not implemented.');
  }

  /**
   * In Taproot, a control block is a data structure used during script path spends to prove that a particular script is part of the Taproot output's script tree.
   */
  controlBlock: string;

  /**
   * In Taproot, tweaking a public key involves modifying an existing public key to create a new one that embeds additional information, such as commitments to scripts or data.
   */
  tweakedPubkey: string;

  /**
   *
   * @ignore
   */
  asTapLeaf(tapTree: TapScript[], tPubkey: string) {
    this.tweakedPubkey = tPubkey;
    this.controlBlock = getCblock(this.tapScript, tapTree);
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
}
