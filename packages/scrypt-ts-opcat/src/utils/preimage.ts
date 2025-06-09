import { sha256 } from '@noble/hashes/sha256';
import * as tools from 'uint8array-tools';
import { ByteString, SHPreimage, Sig } from '../smart-contract/types/index.js';
import { assert } from '../smart-contract/fns/assert.js';
import { secp256k1 } from '@noble/curves/secp256k1';
import * as utils from '@noble/curves/abstract/utils';

/**
 * TAPSIGHASH + TAPSIGHASH + PREIMAGE_SIGHASH + PREIMAGE_EPOCH
 * @ignore
 */
export const PREIMAGE_PREFIX: ByteString =
  'f40a48df4b2a70c8b4924bf2654661ed3d95fd66a313eb87237597c628e4a031f40a48df4b2a70c8b4924bf2654661ed3d95fd66a313eb87237597c628e4a0310000';

/**
 * TAG_HASH + TAG_HASH + Gx + Gx
 * @ignore
 */
export const E_PREIMAGE_PREFIX: ByteString =
  '7bb52d7a9fef58323eb1bf7a407db382d2f3f2d81bb1224f49fe518f6d48d37c7bb52d7a9fef58323eb1bf7a407db382d2f3f2d81bb1224f49fe518f6d48d37c79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f8179879be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798';
/**
 * @ignore
 */
export const GX: ByteString = '79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798';

/**
 * @ignore
 */
export function splitSighashPreimage(preimage: Uint8Array) {
  return {
    tapSighash1: preimage.subarray(0, 32),
    tapSighash2: preimage.subarray(32, 64),
    epoch: preimage.subarray(64, 65),
    sighashType: preimage.subarray(65, 66),
    txVersion: preimage.subarray(66, 70),
    nLockTime: preimage.subarray(70, 74),
    shaPrevouts: preimage.subarray(74, 106),
    shaSpentAmounts: preimage.subarray(106, 138),
    shaSpentScripts: preimage.subarray(138, 170),
    shaSequences: preimage.subarray(170, 202),
    shaOutputs: preimage.subarray(202, 234),
    spendType: preimage.subarray(234, 235),
    inputIndex: preimage.subarray(235, 239),
    tapLeafHash: preimage.subarray(239, 271),
    keyVersion: preimage.subarray(271, 272),
    codeSepPos: preimage.subarray(272),
  };
}

/**
 * @ignore
 */
export function toSHPreimageObj(
  preimageParts: ReturnType<typeof splitSighashPreimage>,
  _e: Uint8Array,
  eLastByte: number,
): SHPreimage {
  return {
    nVersion: tools.toHex(preimageParts.txVersion),
    nLockTime: tools.toHex(preimageParts.nLockTime),
    shaPrevouts: tools.toHex(preimageParts.shaPrevouts),
    shaSpentAmounts: tools.toHex(preimageParts.shaSpentAmounts),
    shaSpentScripts: tools.toHex(preimageParts.shaSpentScripts),
    shaSequences: tools.toHex(preimageParts.shaSequences),
    shaOutputs: tools.toHex(preimageParts.shaOutputs),
    spendType: tools.toHex(preimageParts.spendType),
    inputIndex: tools.toHex(preimageParts.inputIndex),
    tapLeafHash: tools.toHex(preimageParts.tapLeafHash),
    keyVersion: tools.toHex(preimageParts.keyVersion),
    codeSepPos: tools.toHex(preimageParts.codeSepPos),
    _eWithoutLastByte: tools.toHex(_e),
    _eLastByte: BigInt(eLastByte),
  };
}

/**
 * @ignore
 */
export function shPreimageToSig(preimage: SHPreimage): Sig {
  const sighash = sha256(
    tools.fromHex(
      PREIMAGE_PREFIX +
        preimage.nVersion +
        preimage.nLockTime +
        preimage.shaPrevouts +
        preimage.shaSpentAmounts +
        preimage.shaSpentScripts +
        preimage.shaSequences +
        preimage.shaOutputs +
        preimage.spendType +
        preimage.inputIndex +
        preimage.tapLeafHash +
        preimage.keyVersion +
        preimage.codeSepPos,
    ),
  );
  const e = tools.toHex(sha256(tools.concat([tools.fromHex(E_PREIMAGE_PREFIX), sighash])));
  assert(preimage._eLastByte < 127n, 'invalid value of _e');
  const eLastByte =
    preimage._eLastByte == 0n ? '00' : preimage._eLastByte.toString(16).padStart(2, '0');
  assert(e == preimage._eWithoutLastByte + eLastByte, 'invalid value of _e');
  const s =
    GX + preimage._eWithoutLastByte + (preimage._eLastByte + 1n).toString(16).padStart(2, '0');
  return Sig(s);
}

/**
 * @ignore
 */
export function shPreimageGetE(sighash: Uint8Array) {
  const Gx = utils.numberToBytesBE(secp256k1.CURVE.Gx, 32);

  const tagHash = sha256('BIP0340/challenge');
  const tagHashMsg = utils.concatBytes(Gx, Gx, sighash);
  const taggedHash = sha256(utils.concatBytes(tagHash, tagHash, tagHashMsg));
  const e = utils.bytesToNumberLE(taggedHash) % secp256k1.CURVE.n;
  return utils.numberToBytesLE(e, 32);
}
