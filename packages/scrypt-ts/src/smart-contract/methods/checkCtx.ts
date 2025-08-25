import { AbstractContract } from '../abstractContract.js';
import { SHPreimage, Prevouts, SpentScriptHashes } from '../types/index.js';
import * as tools from 'uint8array-tools';
import { Outpoint, SpentAmounts, SpentDataHashes } from '../types/structs.js';
import { assert, hash256, intToByteString, slice } from '../fns/index.js';
import { InputIndex } from '../../globalTypes.js';


/**
 * Validates the transaction context against the provided preimage data.
 * @ignore
 * @param self - The contract instance
 * @param shPreimage - The preimage data containing hash commitments
 * @param inputIndex - Index of the current input
 * @param prevouts - Serialized previous outputs
 * @param prevout - Current output being spent
 * @param spentScriptHashes - Hashes of spent script hashes
 * @param spentAmounts - Hashes of spent amounts
 * @param stateHashes - Hashes of spent data
 * @returns true if all validations pass, otherwise throws assertion errors
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
  assert(prevout.txHash + intToByteString(prevout.outputIndex, 4n) === slice(prevouts, BigInt(inputIndex)*36n, BigInt(inputIndex + 1)*36n), `invalid prevout`);

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
