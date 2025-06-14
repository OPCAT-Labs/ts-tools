import { AbstractContract } from '../abstractContract.js';
import { SHPreimage, Prevouts, SpentScriptHashes } from '../types/index.js';
import * as tools from 'uint8array-tools';
import { bigintToByteString } from '../../utils/common.js';
import { Outpoint, SpentAmounts, SpentDataHashes } from '../types/structs.js';
import { sha256, intToByteString, len, assert } from '../fns/index.js';
import { InputIndex } from '../../globalTypes.js';

/**
 * @ignore
 * @param self
 * @param shPreimage
 * @param inputIndex
 * @param prevouts
 * @param prevout
 * @param spentScriptsCtx
 * @param spentAmountsCtx
 * @param stateHashes
 * @returns
 */
export function checkCtxImpl(
  self: AbstractContract,
  shPreimage: SHPreimage,
  inputIndex: InputIndex,
  prevouts: Prevouts,
  prevout: Outpoint,
  spentScriptsCtx: SpentScriptHashes,
  spentAmountsCtx: SpentAmounts,
  stateHashes: SpentDataHashes,
): boolean {
  // check sHPreimage
  // self.checkSHPreimage(shPreimage);

  // // check inputIndex
  // const inputIndexVal = BigInt(inputIndex);
  // assert(bigintToByteString(inputIndexVal, 4n) === shPreimage.inputIndex, 'inputIndex mismatch');

  // // check prevouts
  // assert(
  //   tools.compare(
  //     tools.fromHex(shPreimage.shaPrevouts),
  //     tools.fromHex(sha256(prevouts.join(''))),
  //   ) === 0,
  //   'shaPrevouts mismatch',
  // );

  // // check prevout
  // assert(prevout.txHash + prevout.outputIndex == prevouts[inputIndex], `invalid prevout`);

  // // check spentScripts
  // assert(
  //   tools.compare(
  //     tools.fromHex(shPreimage.shaSpentScripts),
  //     tools.fromHex(
  //       sha256(
  //         spentScriptsCtx.reduce((acc, curr) => acc + intToByteString(len(curr)) + curr, ''),
  //       ),
  //     ),
  //   ) === 0,
  //   'shaSpentScripts mismatch',
  // );

  // // check spentAmounts
  // assert(
  //   tools.compare(
  //     tools.fromHex(shPreimage.shaSpentAmounts),
  //     tools.fromHex(sha256(spentAmountsCtx.join(''))),
  //   ) === 0,
  //   'shaSpentAmounts mismatch',
  // );

  return true;
}
