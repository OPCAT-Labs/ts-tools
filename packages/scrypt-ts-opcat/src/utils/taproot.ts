import { bip341, rootHashFromPath } from '@scrypt-inc/bitcoinjs-lib';
import { requireTrue } from './common.js';
import * as tools from 'uint8array-tools';

class TaprootConst {
  // Tag for input annex. If there are at least two witness elements for a transaction input,
  // and the first byte of the last element is 0x50, this last element is called annex, and
  // has meanings independent of the script
  static readonly ANNEX_TAG = 0x50;
  static readonly TAPROOT_LEAF_MASK = 0xfe;
  static readonly TAPROOT_LEAF_TAPSCRIPT = 0xc0;
  static readonly TAPROOT_CONTROL_BASE_SIZE = 33;
  static readonly TAPROOT_CONTROL_NODE_SIZE = 32;
  static readonly TAPROOT_CONTROL_MAX_NODE_COUNT = 128;

  static readonly TAPROOT_CONTROL_MAX_SIZE =
    TaprootConst.TAPROOT_CONTROL_BASE_SIZE +
    TaprootConst.TAPROOT_CONTROL_NODE_SIZE * TaprootConst.TAPROOT_CONTROL_MAX_NODE_COUNT;
}

/**
 *
 * @ignore
 */
export function verifyWitnessProgram(
  version: number,
  program: Uint8Array,
  witness: Uint8Array[],
): void {
  if (version !== 1) {
    throw new Error('Invalid program version');
  }
  if (program.length != 32) {
    throw new Error('Invalid program length');
  }

  const stack = Array.from(witness);
  if (stack.length == 0) {
    throw new Error('witness program empty');
  }
  if (
    stack.length >= 2 &&
    stack[stack.length - 1].length &&
    stack[stack.length - 1][0] === TaprootConst.ANNEX_TAG
  ) {
    // Drop annex (this is non-standard; see IsWitnessStandard)
    throw new Error('annex is not supported now');
  }

  if (stack.length === 1) {
    // Key path spending (stack size is 1 after removing optional annex)
    throw new Error('not allowed key path spending');
  } else {
    // Script path spending (stack size is >1 after removing optional annex)
    const control = stack.pop() as Uint8Array;
    const scriptPubKeyBuf = stack.pop() as Uint8Array;

    if (
      control.length < TaprootConst.TAPROOT_CONTROL_BASE_SIZE ||
      control.length > TaprootConst.TAPROOT_CONTROL_MAX_SIZE ||
      (control.length - TaprootConst.TAPROOT_CONTROL_BASE_SIZE) %
        TaprootConst.TAPROOT_CONTROL_NODE_SIZE !=
        0
    ) {
      throw new Error('taproot wrong control size');
    }
    const tapleafHash = computeTapleafHash(
      control[0] & TaprootConst.TAPROOT_LEAF_MASK,
      scriptPubKeyBuf,
    );
    if (!verifyTaprootCommitment(control, program, tapleafHash)) {
      throw new Error('witness program mismatch');
    }
  }
}

function computeTapleafHash(leafVersion: number, scriptBuf: Uint8Array) {
  return bip341.tapleafHash({
    version: leafVersion,
    output: scriptBuf,
  });
}

function verifyTaprootCommitment(
  control: Uint8Array,
  program: Uint8Array,
  tapleafHash: Uint8Array,
) {
  requireTrue(control.length >= TaprootConst.TAPROOT_CONTROL_BASE_SIZE, 'control too short');
  requireTrue(program.length >= 32, 'program is too short');

  try {
    //! The internal pubkey (x-only, so no Y coordinate parity).
    const p = control.slice(1, TaprootConst.TAPROOT_CONTROL_BASE_SIZE);
    //! The output pubkey (taken from the scriptPubKey).
    const q = program;
    // Compute the Merkle root from the leaf and the provided path.
    const merkleRoot = rootHashFromPath(control, tapleafHash);
    // Verify that the output pubkey matches the tweaked internal pubkey, after correcting for parity.

    const tweak = bip341.tweakKey(p, merkleRoot);

    if (tweak === null) {
      throw new Error('tweakKey null');
    }

    // this.point.x.eq(Q.x) && Q.y.mod(new BN(2)).eq(new BN(control[0] & 1));
    return tools.compare(q, tweak.x) === 0;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (err) {
    return false;
  }
}
