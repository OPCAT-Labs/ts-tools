import { AbstractContract } from '../abstractContract.js';
import { SHPreimage, Sig } from '../types/index.js';
import { ContextUtils } from '../builtin-libs/contextUtils.js';
import { toByteString } from '../fns/byteString.js';

/**
 * @ignore
 * @param self
 * @param shPreimage
 * @returns
 */
export function checkSHPreimageImpl(self: AbstractContract, shPreimage: SHPreimage): boolean {
  const sig: Sig = ContextUtils.checkSHPreimage(shPreimage, toByteString('01'))
  return self.checkSig(sig, ContextUtils.pubKey);
}
