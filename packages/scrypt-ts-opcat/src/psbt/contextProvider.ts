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
  uint8ArrayToHex,
  hexToUint8Array,
} from '../utils/common.js';
import { decodeSHPreimage } from '../utils/preimage.js';
import {  crypto} from '@opcat-labs/opcat';
import { sha256 } from '../smart-contract/fns/hashes.js';
import { toByteString } from '../smart-contract/fns/byteString.js';
import { StdUtils } from '../smart-contract/builtin-libs/index.js';

import { reverseBuffer } from './bufferutils.js';
import * as tools from 'uint8array-tools';

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
    //let spentDatas: SpentDatas = toByteString('');

    this._curPsbt.data.inputs.forEach((input) => {
      const { script, data, value } = input.opcatUtxo!;
      if (script) {
        spentScriptHashes += sha256(uint8ArrayToHex(script));
        spentDataHashes += sha256(uint8ArrayToHex(data));
        spentAmounts += StdUtils.uint64ToByteString(value);
      }
    });

    // // get prevouts for all inputs
    let prevouts: Prevouts = toByteString('');
    this._curPsbt.txInputs.forEach((input) => {

      const hash = typeof input.hash === 'string'
        ? reverseBuffer(tools.fromHex(input.hash))
        : input.hash;

      prevouts += `${uint8ArrayToHex(hash)}${StdUtils.uint32ToByteString(BigInt(input.index))}`;
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
