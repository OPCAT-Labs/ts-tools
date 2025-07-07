import { hexToUint8Array } from '../../utils/common.js';
import { toTxHashPreimage } from '../../utils/proof.js';
import { AbstractContract } from '../abstractContract.js';
import { ByteString } from '../types/index.js';
import { Backtrace } from '../builtin-libs/backtrace.js';

import {
  BacktraceInfo,
} from '../types/structs.js';

/**
 * Verifies the backtrace from a contract's UTXO to a genesis outpoint.
 * @ignore
 * @param _self - The contract instance containing the UTXO to backtrace from
 * @param _backtraceInfo - Information needed for backtracing
 * @param _genesisOutpoint - The target genesis outpoint to verify against
 * @returns true if verification succeeds, throws Error if UTXO lacks required txHashPreimage
 * @throws Error when UTXO doesn't have txHashPreimage required for backtracing
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
 * Verifies the backtrace from current script to genesis script.
 * @ignore
 * @param _self - The contract instance containing UTXO data
 * @param _backtraceInfo - Backtrace information to verify
 * @param _genesisScript - The genesis script to trace back to
 * @returns true if verification succeeds, throws Error if verification fails or if UTXO lacks txHashPreimage
 * @throws Error when UTXO doesn't have required txHashPreimage or when backtrace verification fails
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
