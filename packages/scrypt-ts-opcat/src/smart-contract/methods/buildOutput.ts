import { assert } from '../fns/assert.js';
import { toByteString, len } from '../fns/byteString.js';
import { Contextual } from '../types/context.js';
import { ByteString, Int32 } from '../types/index.js';
import { TxUtils } from '../builtin-libs/txUtils.js'
import { OpcatState } from '../types/primitives.js';
import { AbstractContract } from '../abstractContract.js';


/**
 * @ignore
 * Builds a change output for a PSBT (Partially Signed Bitcoin Transaction).
 * 
 * @param psbt - The contextual PSBT containing change information.
 * @returns The serialized change output as a ByteString. Returns empty ByteString if no change script exists.
 */
export function buildChangeOutputImpl(psbt: Contextual): ByteString {
  const changeInfo = psbt.getChangeInfo();
  if (changeInfo.satoshis === 0n) {
    return toByteString('');
  }

  return TxUtils.buildOutput(changeInfo.scriptHash, changeInfo.satoshis);
}


/**
 * @ignore
 * Builds a state output for an OP_CAT enabled smart contract.
 * 
 * @param self - The contract instance
 * @param state - The contract state to serialize
 * @param satoshis - The amount in satoshis for the output
 * @param script - The locking script for the output
 * @returns The built output as ByteString
 * @throws Throws if script is empty
 */
export function buildStateOutputImpl<T extends OpcatState>(
  self: AbstractContract,
  state: T,
  satoshis: Int32,
  script: ByteString
): ByteString {
  const lenScript = len(script);
  assert(lenScript > 0n, 'invalid script');
  const Class = Object.getPrototypeOf(self).constructor as typeof AbstractContract;
  return TxUtils.buildDataOutput(script, satoshis, Class.stateSerialize(state))
}
