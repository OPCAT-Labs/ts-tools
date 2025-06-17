import { method } from '../decorators.js';
import { assert } from '../fns/assert.js';
import { SmartContractLib } from '../smartContractLib.js';
import { ByteString } from '../types/index.js';
import { BacktraceInfo } from '../types/structs.js';
import { TxUtils } from './txUtils.js';
import { TX_INPUT_BYTE_LEN, TX_OUTPUT_BYTE_LEN } from '../consts.js';
import { slice } from '../fns/byteString.js';
import { StdUtils } from './stdUtils.js';

export type ChainTxVerifyResponse = {
  prevPrevScript: ByteString;
  prevPrevOutpoint: ByteString;
};

/**
 * Library for verifying backtraces all the way to the genesis point.
 * @category Library
 * @onchain
 */
export class Backtrace extends SmartContractLib {
  /**
   * Back-to-genesis backtrace verification for a contract which can be backtraced to the genesis outpoint.
   * It will be a valid backtraceInfo if the prevPrevOutpoint is the genesis outpoint or the prevPrevScript is the selfScript.
   * @param backtraceInfo backtrace info to verify, including prevTx and prevPrevTx informations
   * @param t_genesisOutpoint expected genesis outpoint of the contract which usually is a contract property and trustable
   * @param t_selfScript expected self locking script, i.e. this.ctx.spentScript, of the currect spending UTXO context which is trustable
   * @param t_prevTxInputList input list of the prevTx which should be trustable
   */
  @method()
  static verifyFromOutpoint(
    backtraceInfo: BacktraceInfo,
    t_genesisOutpoint: ByteString,
    t_selfScript: ByteString,
    t_prevTxInputList: ByteString,
  ): void {
    const res = Backtrace.verifyChainTxs(backtraceInfo, t_prevTxInputList);
    assert(
      res.prevPrevOutpoint === t_genesisOutpoint || res.prevPrevScript == t_selfScript,
      `can not backtrace to the genesis outpoint`,
    );
  }

  /**
   * Back-to-genesis backtrace verification for a contract which can be backtraced to the genesis script.
   * It will be a valid backtraceInfo if the prevPrevScript is the genesis script or the selfScript.
   * @param backtraceInfo backtrace info to verify, including prevTx and prevPrevTx informations
   * @param t_genesisScript expected genensis locking script which usually is a contract property and trustable
   * @param t_selfScript expected self locking script, i.e. this.ctx.spentScript, of the current spending UTXO context and is trustable
   * @param t_prevTxInputList input list of the prevTx which should be trustable
   */
  @method()
  static verifyFromScript(
    backtraceInfo: BacktraceInfo,
    t_genesisScript: ByteString,
    t_selfScript: ByteString,
    t_prevTxInputList: ByteString,
  ): void {
    const res = Backtrace.verifyChainTxs(backtraceInfo, t_prevTxInputList);
    assert(
      res.prevPrevScript == t_genesisScript || res.prevPrevScript == t_selfScript,
      `can not backtrace to the genesis script`,
    );
  }

  /**
   * Tx chain verification to ensure:
   *   1. the current spending UTXO is the output of prevTx
   *   2. the specific input of prevTx is the output of prevPrevTx
   * @param backtraceInfo backtrace info to verify, including prevTx and prevPrevTx preimages
   * @param t_prevTxInputList input list of the prevTx which should be trustable
   * @returns locking script and outpoint of the specified output of prevPrevTx
   */
  @method()
  static verifyChainTxs(
    backtraceInfo: BacktraceInfo,
    t_prevTxInputList: ByteString,
  ): ChainTxVerifyResponse {
    // check if the passed prevTxInput and prevTxInputIndexVal are matched
    assert(
      slice(
        t_prevTxInputList, 
        backtraceInfo.prevTxInputIndex * TX_INPUT_BYTE_LEN,
        (backtraceInfo.prevTxInputIndex + 1n) * TX_INPUT_BYTE_LEN
      ) ==
      TxUtils.mergeInput(backtraceInfo.prevTxInput),
    );
    // check if prevTxHash of passed prevTxInput and prevPrevTx are matched
    const prevPrevTxHash = backtraceInfo.prevTxInput.prevTxHash;
    assert(
      prevPrevTxHash ==
        TxUtils.getTxHashFromTxHashPreimage(backtraceInfo.prevPrevTxPreimage),
    );
    // all fields in backtraceInfo have been verified
    const prevPrevScript =
      slice(
        backtraceInfo.prevPrevTxPreimage.outputList,
        backtraceInfo.prevTxInput.prevOutputIndex * TX_OUTPUT_BYTE_LEN,
        (backtraceInfo.prevTxInput.prevOutputIndex + 1n) * TX_OUTPUT_BYTE_LEN
      );
    const prevPrevOutpoint =
      prevPrevTxHash + StdUtils.uint32ToByteString(backtraceInfo.prevTxInput.prevOutputIndex);
    return { prevPrevScript, prevPrevOutpoint };
  }
}
