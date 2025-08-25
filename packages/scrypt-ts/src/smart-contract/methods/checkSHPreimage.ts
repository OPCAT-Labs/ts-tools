import { AbstractContract } from '../abstractContract.js';
import { SHPreimage, Sig } from '../types/index.js';
import { ContextUtils } from '../builtin-libs/contextUtils.js';
import { toByteString } from '../fns/byteString.js';


/**
 * Verifies a signature against the contract's public key using the provided SH preimage.
 * @ignore
 * @param self - The contract instance to verify against
 * @param shPreimage - The SH preimage containing the signature to verify
 * @returns True if the signature is valid for this contract's public key
 */
export function checkSHPreimageImpl(self: AbstractContract, shPreimage: SHPreimage): boolean {
  const sig: Sig = ContextUtils.checkSHPreimage(shPreimage, toByteString('01'))
  return self.checkSig(sig, ContextUtils.pubKey);
}
