import { Interpreter } from '@scrypt-inc/bitcoinjs-lib';
import { Witness } from '../globalTypes.js';
import { ExtPsbt } from '../psbt/extPsbt.js';
import * as varuint from 'varuint-bitcoin';

function scriptWitnessToWitnessStack(scriptWitness: Uint8Array) {
  const witness: Witness = [];
  function readSlice(buffer: Uint8Array, offset: number, len: number) {
    return buffer.slice(offset, offset + len);
  }
  function readVarInt(buffer: Uint8Array, offset: number) {
    return varuint.decode(buffer, offset);
  }
  function readVarSlice(buffer: Uint8Array, offset: number) {
    const { numberValue, bytes } = readVarInt(buffer, offset);
    const slice = readSlice(buffer, offset + bytes, numberValue);
    return { slice, bytes: bytes + numberValue };
  }

  let offset = 0;
  const { numberValue, bytes } = readVarInt(scriptWitness, offset);

  offset += bytes;
  for (let i = 0; i < numberValue; i++) {
    const { slice, bytes } = readVarSlice(scriptWitness, offset);
    witness.push(slice);
    offset += bytes;
  }

  return witness;
}

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

  const prevOuts = extPsbt.data.inputs.map((input) => input.witnessUtxo);

  const interp = new Interpreter();
  const prevScript = prevOuts[inputIndex].script;
  const prevSatoshi = Number(prevOuts[inputIndex].value);

  const finalScriptWitness =
    extPsbt.data.inputs[inputIndex].finalScriptWitness || Uint8Array.from([]);

  const witness: Witness = scriptWitnessToWitnessStack(finalScriptWitness);

  const flags =
    Interpreter.SCRIPT_VERIFY_TAPROOT |
    Interpreter.SCRIPT_VERIFY_WITNESS |
    Interpreter.SCRIPT_VERIFY_CHECKLOCKTIMEVERIFY |
    Interpreter.SCRIPT_VERIFY_CHECKSEQUENCEVERIFY;
  const ret = interp.verify(
    new Uint8Array(0),
    prevScript,
    extPsbt.unsignedTx,
    inputIndex,
    flags,
    witness,
    prevSatoshi,
    prevOuts,
  );
  if (!ret) {
    return interp.getErr();
  }

  return true;
}
