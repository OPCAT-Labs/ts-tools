import { AbstractContract } from '../abstractContract.js';
import { SHPreimage, Prevouts, SpentScripts } from '../types/index.js';
import * as tools from 'uint8array-tools';
import { bigintToByteString } from '../../utils/common.js';
import { Outpoint, SpentAmounts, SpentDataHashes } from '../types/structs.js';
import { sha256, int32ToByteString, len, assert, hash256 } from '../fns/index.js';
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
  spentScriptsCtx: SpentScripts,
  spentAmountsCtx: SpentAmounts,
  stateHashes: SpentDataHashes,
): boolean {
  // check sHPreimage
  self.checkSHPreimage(shPreimage);

  // check inputIndex
  assert(BigInt(inputIndex) === shPreimage.inputIndex, 'inputIndex mismatch');

  // check prevouts
  assert(
    tools.compare(
      tools.fromHex(shPreimage.hashPrevouts),
      tools.fromHex(hash256(prevouts.join(''))),
    ) === 0,
    'shaPrevouts mismatch',
  );

  // check prevout
  assert(prevout.txHash + prevout.outputIndex == prevouts[inputIndex], `invalid prevout`);

  // check spentScripts
  assert(
    tools.compare(
      tools.fromHex(shPreimage.hashSpentScripts),
      tools.fromHex(
        hash256(
          spentScriptsCtx.reduce((acc, curr) => acc + sha256(curr), ''),
        ),
      ),
    ) === 0,
    'hashSpentScripts mismatch',
  );

  // check spentAmounts
  assert(
    tools.compare(
      tools.fromHex(shPreimage.hashSpentAmounts),
      tools.fromHex(hash256(spentAmountsCtx.join(''))),
    ) === 0,
    'hashSpentAmounts mismatch',
  );


  assert(
    tools.compare(
      tools.fromHex(shPreimage.hashSpentDatas),
      tools.fromHex(hash256(stateHashes.join(''))),
    ) === 0,
    'shaSpentDatas mismatch',
  );

  return true;
}
