import { hexToUint8Array } from '../../utils/common.js';
import { toTxHashPreimage } from '../../utils/proof.js';
import { AbstractContract } from '../abstractContract.js';
import { ByteString } from '../types/index.js';
import { Backtrace } from '../builtin-libs/backtrace.js';
import { hash256 } from '../fns/index.js';

import {
  BacktraceInfo,
} from '../types/structs.js';

/**
 * @ignore
 * @param self
 * @param backtraceInfo
 * @param genesisOutpoint
 * @returns
 */
export function backtraceToOutpointImpl(
  _self: AbstractContract,
  _backtraceInfo: BacktraceInfo,
  _genesisOutpoint: ByteString,
): boolean {
  const prevTxHashPreimageBytes = (_self as any).utxo.txHashPreimage;
  if (!prevTxHashPreimageBytes) {
    throw new Error('utxo should have txHashPreimage for backtrace to genesis outpoint');
  }
  const prevTxHashPreimage = toTxHashPreimage(hexToUint8Array(prevTxHashPreimageBytes!));
  Backtrace.verifyFromOutpoint(_backtraceInfo, _genesisOutpoint, _self.ctx.spentScriptHash, prevTxHashPreimage.inputList);
  return true;
}

/**
 * @ignore
 * @param self
 * @param backtraceInfo
 * @param genesisScript
 * @returns
 */
export function backtraceToScriptImpl(
  _self: AbstractContract,
  _backtraceInfo: BacktraceInfo,
  _genesisScript: ByteString,
): boolean {
  const prevTxHashPreimageBytes = (_self as any).utxo.txHashPreimage;
  if (!prevTxHashPreimageBytes) {
    throw new Error('utxo should have txHashPreimage for backtrace to script');
  }
  const prevTxHashPreimage = toTxHashPreimage(hexToUint8Array(prevTxHashPreimageBytes!));
  Backtrace.verifyFromScript(_backtraceInfo, _genesisScript, _self.ctx.spentScriptHash, prevTxHashPreimage.inputList);
  return true;
}
