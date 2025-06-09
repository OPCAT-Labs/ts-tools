import { AbstractContract } from '../abstractContract.js';
import { PubKey, SHPreimage } from '../types/index.js';
import { assert } from '../fns/assert.js';
import { shPreimageToSig, GX } from '../../utils/preimage.js';

/**
 * @ignore
 * @param self
 * @param shPreimage
 * @returns
 */
export function checkSHPreimageImpl(self: AbstractContract, shPreimage: SHPreimage): boolean {
  const sig = shPreimageToSig(shPreimage);
  assert(self.checkSig(sig, PubKey(GX)), 'sighash preimage check error');
  return true;
}
