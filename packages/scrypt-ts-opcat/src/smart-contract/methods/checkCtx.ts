import { AbstractContract } from '../abstractContract.js';
import { SHPreimage, Prevouts, SpentScriptHashes } from '../types/index.js';
import * as tools from 'uint8array-tools';
import { Outpoint, SpentAmounts, SpentDataHashes } from '../types/structs.js';
import { assert, hash256, num2bin, slice } from '../fns/index.js';
import { InputIndex } from '../../globalTypes.js';

/**
 * @ignore
 * @param self
 * @param shPreimage
 * @param inputIndex
 * @param prevouts
 * @param prevout
 * @param spentScriptHashes
 * @param spentAmounts
 * @param stateHashes
 * @returns
 */
export function checkCtxImpl(
  self: AbstractContract,
  shPreimage: SHPreimage,
  inputIndex: InputIndex,
  prevouts: Prevouts,
  prevout: Outpoint,
  spentScriptHashes: SpentScriptHashes,
  spentAmounts: SpentAmounts,
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
      tools.fromHex(hash256(prevouts)),
    ) === 0,
    'hashPrevouts mismatch',
  );

  // check prevout
  assert(prevout.txHash + num2bin(prevout.outputIndex, 4n) === slice(prevouts, BigInt(inputIndex)*36n, BigInt(inputIndex + 1)*36n), `invalid prevout`);

  // check spentScripts
  assert(
    tools.compare(
      tools.fromHex(shPreimage.hashSpentScriptHashes),
      tools.fromHex(
        hash256(spentScriptHashes),
      ),
    ) === 0,
    'hashSpentScriptHashes mismatch',
  );

  // check spentAmounts
  assert(
    tools.compare(
      tools.fromHex(shPreimage.hashSpentAmounts),
      tools.fromHex(hash256(spentAmounts)),
    ) === 0,
    'hashSpentAmounts mismatch',
  );


  assert(
    tools.compare(
      tools.fromHex(shPreimage.hashSpentDataHashes),
      tools.fromHex(hash256(stateHashes)),
    ) === 0,
    'hashSpentDataHashes mismatch',
  );

  return true;
}
