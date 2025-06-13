import { Interpreter, Script } from '@opcat-labs/opcat';
import { ExtPsbt } from '../psbt/extPsbt.js';

/**
 * Verify that an input of `ExtPsbt` can be unlocked correctly. The extPsbt should be finalized.
 * @param extPsbt
 * @param inputIndex
 * @returns true if success
 */
export function bvmVerify(extPsbt: ExtPsbt, inputIndex: number = 0): true | string {
  if (!extPsbt.isFinalized) {
    throw new Error('ExtPsbt is not finalized');
  }

  const prevOuts = extPsbt.unsignedTx.inputs.map((input) => input.output);

  const interp = new Interpreter();
  const prevScript = prevOuts[inputIndex].script;
  const prevSatoshi = Number(prevOuts[inputIndex].satoshis);

  const finalScriptSig =
    extPsbt.data.inputs[inputIndex].finalScriptSig || Uint8Array.from([]);

  const flags = Interpreter.DEFAULT_FLAGS
  const ret = interp.verify(
    Script.fromBuffer(Buffer.from(finalScriptSig)),
    prevScript,
    extPsbt.unsignedTx,
    inputIndex,
    flags,
    prevSatoshi,
  );
  if (!ret) {
    return interp.errstr;
  }

  return true;
}
