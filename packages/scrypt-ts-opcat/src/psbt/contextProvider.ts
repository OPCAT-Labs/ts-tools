import { InputIndex } from '../globalTypes.js';
import {
  SpentScripts,
  SpentAmounts,
  Prevouts,
  Outpoint,
  SpentDatas,
  SHPreimage,
  SpentDataHashes,
} from '../smart-contract/types/structs.js';
import { InputContext } from '../smart-contract/types/context.js';
import { IExtPsbt } from './types.js';
import {
  emptyByteString,
  fillFixedArray,
  uint8ArrayToHex,
  bigintToByteString,
  hexToUint8Array,
} from '../utils/common.js';
import { decodeSHPreimage } from '../utils/preimage.js';
import { TX_INPUT_COUNT_MAX } from '../smart-contract/consts.js';
import {  crypto} from '@opcat-labs/opcat';
import { sha256 } from '../smart-contract/fns/hashes.js';


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
    const spentAmounts: SpentAmounts = fillFixedArray(0n, TX_INPUT_COUNT_MAX);
    const spentDatas: SpentDatas = fillFixedArray(emptyByteString(), TX_INPUT_COUNT_MAX);
    const spentDataHashes: SpentDataHashes = fillFixedArray(emptyByteString(), TX_INPUT_COUNT_MAX);
    spentScripts.length = TX_INPUT_COUNT_MAX;
    spentAmounts.length = TX_INPUT_COUNT_MAX;
    this._curPsbt.data.inputs.forEach((input, inputIndex) => {
      const {script, data, value} = input.opcatUtxo!;
      if (script) {
        spentScripts[inputIndex] = uint8ArrayToHex(script);
        spentDatas[inputIndex] = uint8ArrayToHex(data)
        spentDataHashes[inputIndex] = sha256(uint8ArrayToHex(data));
        spentAmounts[inputIndex] = value;
      }
    });

    // get prevouts for all inputs
    const prevouts: Prevouts = fillFixedArray(emptyByteString(), TX_INPUT_COUNT_MAX);
    this._curPsbt.txInputs.forEach((input, inputIndex) => {
      prevouts[inputIndex] =
        `${uint8ArrayToHex(input.hash)}${bigintToByteString(BigInt(input.index), 4n)}`;
    });

    const inputs = this._curPsbt.data.inputs
      .map((_, inputIndex) => {
          return {
            inputIndex,
          };
      })

    const preimages = this.calculateInputSHPreimages();

    // calculate input context for input which has tapLeafScript
    // cache input context at this._inputContexts
    inputs.forEach((inputTapLeafHash, index) => {
      const { inputIndex } = inputTapLeafHash;
      const prevout: Outpoint = {
        txHash: uint8ArrayToHex(this._curPsbt.txInputs[inputIndex].hash),
        outputIndex: bigintToByteString(BigInt(this._curPsbt.txInputs[inputIndex].index), 4n),
      };
      const spentScript = spentScripts[inputIndex];
      const spentAmount = spentAmounts[inputIndex];
      const spentData = spentDatas[inputIndex];
      const shPreimage = preimages[index];
      this._inputContexts.set(inputIndex, {
        shPreimage,
        prevouts,
        // prevout can not be derived due to the size of outpoint is bigger than 1, so it would introduce OP_MUL for random access of `prevouts`
        prevout,
        spentScripts,
        spentAmounts,
        spentDataHashes,
        // derived
        inputCount: BigInt(this._curPsbt.txInputs.length),
        spentScript,
        spentAmount,
        spentData,
      });
    });
  }


  calculateInputSHPreimages(): SHPreimage[] {

    return this._curPsbt.unsignedTx.inputs.map((_, inputIndex) => {
      const rawSHPreimage = this._curPsbt.unsignedTx.getPreimage(inputIndex, crypto.Signature.SIGHASH_ALL);

      return decodeSHPreimage(hexToUint8Array(rawSHPreimage))
    })
  }
}
