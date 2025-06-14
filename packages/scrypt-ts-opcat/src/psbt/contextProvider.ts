import { InputIndex } from '../globalTypes.js';
import {
  SpentScriptHashes,
  SpentAmounts,
  Prevouts,
  Outpoint,
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
  byteStringToBigInt,
} from '../utils/common.js';
import { decodeSHPreimage } from '../utils/preimage.js';
import { TX_INPUT_COUNT_MAX, TX_OUTPUT_DATA_HASH_LEN, TX_OUTPUT_SATOSHI_BYTE_LEN, TX_OUTPUT_SCRIPT_HASH_LEN } from '../smart-contract/consts.js';
import {  crypto} from '@opcat-labs/opcat';
import { sha256 } from '../smart-contract/fns/hashes.js';
import { slice, toByteString } from '../smart-contract/fns/byteString.js';
import { StdUtils } from '../smart-contract/builtin-libs/index.js';


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
    let spentDataHashes: SpentDataHashes = toByteString('')
    let spentScriptHashes: SpentScriptHashes = toByteString('')
    let spentAmounts: SpentAmounts = toByteString('')

    this._curPsbt.data.inputs.forEach((input, inputIndex) => {
      const {script, data, value} = input.opcatUtxo!;
      if (script) {
        spentScriptHashes += sha256(uint8ArrayToHex(script));
        spentDataHashes += sha256(uint8ArrayToHex(data));
        spentAmounts += bigintToByteString(value, 8n);
      }
    });

    // // get prevouts for all inputs
    let prevouts: Prevouts = toByteString('');
    this._curPsbt.txInputs.forEach((input, inputIndex) => {
      prevouts += `${uint8ArrayToHex(input.hash)}${bigintToByteString(BigInt(input.index), 4n)}`;
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
        outputIndex: BigInt(this._curPsbt.txInputs[inputIndex].index),
      };
      const shPreimage = preimages[index];
      this._inputContexts.set(inputIndex, {
        // ParamCtx
        shPreimage,
        prevouts,
        spentScriptHashes,
        spentAmounts,
        spentDataHashes,
        // DerivedCtx
        prevout,
        inputCount: BigInt(this._curPsbt.txInputs.length),
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
