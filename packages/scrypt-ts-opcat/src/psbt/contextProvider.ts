import { InputIndex } from '../globalTypes.js';
import {
  SpentScripts,
  SpentAmounts,
  InputStateProof,
  Prevouts,
  Outpoint,
} from '../smart-contract/types/structs.js';
import { InputContext } from '../smart-contract/types/context.js';
import { IExtPsbt } from './types.js';
import {
  emptyByteString,
  fillFixedArray,
  hexToUint8Array,
  uint8ArrayToHex,
  sigHashTypeToNumber,
  bigintToByteString,
  emptyInputStateProof,
} from '../utils/common.js';
import { shPreimageGetE, splitSighashPreimage, toSHPreimageObj } from '../utils/preimage.js';
import { Tap } from '@cmdcode/tapscript';
import { TX_INPUT_COUNT_MAX } from '../smart-contract/consts.js';
import { FixedArray, SigHashType } from '../smart-contract/types/index.js';
import { toHashRootTxHashPreimage, toTxHashPreimage } from '../utils/proof.js';

/** @ignore */
export class ContextProvider {
  private _curPsbt: IExtPsbt;
  private _inputContexts: Map<InputIndex, InputContext>;

  constructor(psbt: IExtPsbt) {
    this._curPsbt = psbt;
    this._inputContexts = new Map();
  }

  hasInputCtx(inputIndex: InputIndex): boolean {
    return this._inputContexts.has(inputIndex);
  }

  getInputCtx(inputIndex: InputIndex): InputContext {
    if (!this._inputContexts.has(inputIndex)) {
      this.calculateInputCtxs();
    }

    if (!this._inputContexts.has(inputIndex)) {
      throw new Error(
        `The context of input[${inputIndex}] is not set. Call calculateInputCtxs() first!`,
      );
    }
    return this._inputContexts.get(inputIndex);
  }

  calculateInputCtxs(): void {
    const spentScripts: SpentScripts = fillFixedArray(emptyByteString(), TX_INPUT_COUNT_MAX);
    const spentAmounts: SpentAmounts = fillFixedArray(emptyByteString(), TX_INPUT_COUNT_MAX);
    spentScripts.length = TX_INPUT_COUNT_MAX;
    spentAmounts.length = TX_INPUT_COUNT_MAX;
    this._curPsbt.data.inputs.forEach((input, inputIndex) => {
      const script = input.witnessUtxo?.script;
      if (script) {
        spentScripts[inputIndex] = uint8ArrayToHex(script);
        spentAmounts[inputIndex] = bigintToByteString(BigInt(input.witnessUtxo?.value), 8n);
      }
    });

    // get prevouts for all inputs
    const prevouts: Prevouts = fillFixedArray(emptyByteString(), TX_INPUT_COUNT_MAX);
    this._curPsbt.txInputs.forEach((input, inputIndex) => {
      prevouts[inputIndex] =
        `${uint8ArrayToHex(input.hash)}${bigintToByteString(BigInt(input.index), 4n)}`;
    });

    // get tapLeafHashes for each input with tapLeafScript
    const inputTapLeafHashes = this._curPsbt.data.inputs
      .map((input, inputIndex) => {
        if (input.tapLeafScript) {
          return {
            inputIndex,
            tapLeafHash: Tap.encodeScript(input.tapLeafScript[0].script),
          };
        } else {
          return {
            inputIndex,
            tapLeafHash: undefined,
          };
        }
      })
      .filter((input) => input.tapLeafHash !== undefined);

    const preimages = this.calculateInputSHPreimages(inputTapLeafHashes);

    const inputStateProofs = this.calculateInputProofs();

    // calculate input context for input which has tapLeafScript
    // cache input context at this._inputContexts
    inputTapLeafHashes.forEach((inputTapLeafHash, index) => {
      const { inputIndex } = inputTapLeafHash;
      const prevout: Outpoint = {
        txHash: uint8ArrayToHex(this._curPsbt.txInputs[inputIndex].hash),
        outputIndex: bigintToByteString(BigInt(this._curPsbt.txInputs[inputIndex].index), 4n),
      };
      const spentScript = spentScripts[inputIndex];
      const spentAmount = spentAmounts[inputIndex];
      const shPreimage = preimages[index].SHPreimageObj;
      const nextStateHashes = this._curPsbt.getTxoStateHashes();
      this._inputContexts.set(inputIndex, {
        inputIndexVal: BigInt(inputIndex),
        shPreimage,
        prevouts,
        // prevout can not be derived due to the size of outpoint is bigger than 1, so it would introduce OP_MUL for random access of `prevouts`
        prevout,
        spentScripts,
        spentAmounts,
        nextStateHashes,
        inputStateProof: inputStateProofs[inputIndex],
        inputStateProofs,
        // derived
        inputCount: BigInt(this._curPsbt.txInputs.length),
        spentScript,
        spentAmount,
      });
    });
  }

  calculateInputProofs(): FixedArray<InputStateProof, typeof TX_INPUT_COUNT_MAX> {
    const inputStateProofs = fillFixedArray(emptyInputStateProof(), TX_INPUT_COUNT_MAX);

    this._curPsbt.txInputs.forEach((_, inputIndex) => {
      const utxo = this._curPsbt.getStatefulInputUtxo(inputIndex);
      if (utxo) {
        const txHashPreimg = toHashRootTxHashPreimage(
          toTxHashPreimage(hexToUint8Array(utxo.txHashPreimage)),
        );
        inputStateProofs[inputIndex] = {
          txHashPreimage: txHashPreimg,
          outputIndexVal: BigInt(utxo.outputIndex),
          stateHashes: utxo.txoStateHashes,
        };
      }
    });

    return inputStateProofs;
  }

  calculateInputSHPreimages(inputTapLeafHashes: { inputIndex: number; tapLeafHash: string }[]) {
    const tx = this._curPsbt.unsignedTx;
    const spentScripts: Uint8Array[] = this._curPsbt.data.inputs.map((input) => {
      return input.witnessUtxo.script;
    });
    const spentValues: bigint[] = this._curPsbt.data.inputs.map((input) => input.witnessUtxo.value);

    let eBuffList: Array<any> = []; // eslint-disable-line @typescript-eslint/no-explicit-any
    let sighashList: Array<{
      preimage: Uint8Array;
      hash: Uint8Array;
    }> = [];

    let found = false;
    const lastInput = tx.ins[tx.ins.length - 1];

    while (true) {
      sighashList = inputTapLeafHashes.map((input) => {
        let sighashType = this._curPsbt.getSigHashType(input.inputIndex);
        if (sighashType === undefined) {
          // sighashType is not set, using default value SigHash.DEFAULT
          sighashType = SigHashType.DEFAULT;
        }
        // todo: confirm the value of annex
        const annex = undefined;
        // todo: confirm the value of codeSeparatorPos
        const codeSeparatorPos = 0xffffffff;
        const sighash = tx.hashForWitnessV1(
          input.inputIndex,
          spentScripts,
          spentValues,
          sigHashTypeToNumber(sighashType),
          hexToUint8Array(input.tapLeafHash),
          annex,
          codeSeparatorPos,
        );
        const preimage = tx.shPreimageForWitnessV1(
          input.inputIndex,
          spentScripts,
          spentValues,
          sigHashTypeToNumber(sighashType),
          hexToUint8Array(input.tapLeafHash),
          annex,
          codeSeparatorPos,
        );

        return {
          preimage,
          hash: sighash,
        };
      });
      eBuffList = sighashList.map((sighash) => shPreimageGetE(sighash.hash));

      if (
        eBuffList.every((eBuff) => {
          const lastByte = eBuff[eBuff.length - 1];
          return lastByte < 127;
        })
      ) {
        found = true;
        break;
      }
      lastInput.sequence -= 1;
    }
    if (!found) {
      throw new Error('No valid preimage found!');
    }

    return inputTapLeafHashes.map((_, index) => {
      const eBuff = eBuffList[index];
      const sighash = sighashList[index];
      const _e = eBuff.slice(0, eBuff.length - 1); // e' - e without last byte
      const lastByte = eBuff[eBuff.length - 1];
      const preimageParts = splitSighashPreimage(sighash.preimage);

      return {
        SHPreimageObj: toSHPreimageObj(preimageParts, _e, lastByte),
        sighash: sighash,
      };
    });
  }
}
