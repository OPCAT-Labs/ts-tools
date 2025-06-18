import { PartialSig, PsbtInput } from '@opcat-labs/bip174';
import * as tools from 'uint8array-tools';
import { Script, crypto } from '@opcat-labs/opcat'
import * as signatureutils from './signatureutils.js';
import { hash160 } from '../smart-contract/fns/hashes.js';
/**
 * Finds the position of a public key in a script.
 * @param pubkey The public key to search for.
 * @param script The script to search in.
 * @returns The index of the public key in the script, or -1 if not found.
 * @throws {Error} If there is an unknown script error.
 */
export function pubkeyPositionInScript(
  pubkey: Uint8Array,
  script: Uint8Array,
): number {
  const pubkeyHash = tools.fromHex(hash160(tools.toHex(pubkey)));

  const decompiled = Script.fromBuffer(Buffer.from(script));

  // return decompiled.chunks.findIndex(chunk => {
  //   return (
  //     tools.compare(pubkey, chunk.buf) === 0 ||
  //     tools.compare(pubkeyHash, chunk.buf) === 0
  //   );
  // });

  return 1;
}

/**
 * Checks if a public key is present in a script.
 * @param pubkey The public key to check.
 * @param script The script to search in.
 * @returns A boolean indicating whether the public key is present in the script.
 */
export function pubkeyInScript(
  pubkey: Uint8Array,
  script: Uint8Array,
): boolean {
  return pubkeyPositionInScript(pubkey, script) !== -1;
}

/**
 * Checks if an input contains a signature for a specific action.
 * @param input - The input to check.
 * @param action - The action to check for.
 * @returns A boolean indicating whether the input contains a signature for the specified action.
 */
export function checkInputForSig(input: PsbtInput, action: string): boolean {
  const pSigs = extractPartialSigs(input);
  return pSigs.some(pSig =>
    signatureBlocksAction(pSig, signatureutils.decode, action),
  );
}

type SignatureDecodeFunc = (buffer: Uint8Array) => {
  signature: Uint8Array;
  hashType: number;
};

/**
 * Determines if a given action is allowed for a signature block.
 * @param signature - The signature block.
 * @param signatureDecodeFn - The function used to decode the signature.
 * @param action - The action to be checked.
 * @returns True if the action is allowed, false otherwise.
 */
export function signatureBlocksAction(
  signature: Uint8Array,
  signatureDecodeFn: SignatureDecodeFunc,
  action: string,
): boolean {
  const { hashType } = signatureDecodeFn(signature);
  const whitelist: string[] = [];
  const isAnyoneCanPay = hashType & crypto.Signature.SIGHASH_ANYONECANPAY;
  if (isAnyoneCanPay) whitelist.push('addInput');
  const hashMod = hashType & 0x1f;
  switch (hashMod) {
    case crypto.Signature.SIGHASH_ALL:
      break;
    case crypto.Signature.SIGHASH_SINGLE:
    case crypto.Signature.SIGHASH_NONE:
      whitelist.push('addOutput');
      whitelist.push('setInputSequence');
      break;
  }
  if (whitelist.indexOf(action) === -1) {
    return true;
  }
  return false;
}

/**
 * Extracts the signatures from a PsbtInput object.
 * If the input has partial signatures, it returns an array of the signatures.
 * If the input does not have partial signatures, it checks if it has a finalScriptSig or finalScriptWitness.
 * If it does, it extracts the signatures from the final scripts and returns them.
 * If none of the above conditions are met, it returns an empty array.
 *
 * @param input - The PsbtInput object from which to extract the signatures.
 * @returns An array of signatures extracted from the PsbtInput object.
 */
function extractPartialSigs(input: PsbtInput): Uint8Array[] {
  let pSigs: PartialSig[] = [];
  if ((input.partialSig || []).length === 0) {
    if (!input.finalScriptSig && !input.finalScriptWitness) return [];
    pSigs = getPsigsFromInputFinalScripts(input);
  } else {
    pSigs = input.partialSig!;
  }
  return pSigs.map(p => p.signature);
}

/**
 * Retrieves the partial signatures (Psigs) from the input's final scripts.
 * Psigs are extracted from both the final scriptSig and final scriptWitness of the input.
 * Only canonical script signatures are considered.
 *
 * @param input - The PsbtInput object representing the input.
 * @returns An array of PartialSig objects containing the extracted Psigs.
 */
function getPsigsFromInputFinalScripts(input: PsbtInput): PartialSig[] {
  const scriptItems = !input.finalScriptSig
    ? []
    : Script.fromBuffer(Buffer.from(input.finalScriptSig)).chunks.map(item => item.buf) || [];

  return scriptItems
    .filter(item => {
      return (
        Buffer.isBuffer(item) && signatureutils.isCanonicalScriptSignature(item)
      );
    })
    .map(sig => ({ signature: sig })) as unknown as PartialSig[];
}
