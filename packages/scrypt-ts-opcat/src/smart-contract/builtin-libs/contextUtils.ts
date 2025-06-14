import { prop, method } from '../decorators.js';
import { assert } from '../fns/assert.js';
import { slice, toByteString } from '../fns/byteString.js';
import { hash256, sha256 } from '../fns/hashes.js';
import { SmartContractLib } from '../smartContractLib.js';
import { PubKey, ByteString, Sig, Int32, UInt32 } from '../types/primitives.js';
import { SHPreimage, SpentScriptHashes, SpentAmounts, Prevouts, Outpoint } from '../types/structs.js';
import { StdUtils } from './stdUtils.js';
import { TxUtils } from './txUtils.js';

/**
 * Library for verifying preimage.
 * @category Library
 * @onchain
 */
export class ContextUtils extends SmartContractLib {
  /** X coordinate of secp256k1 generator point */
  @prop()
  static readonly Gx: PubKey = PubKey(
    toByteString('79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798'),
  );

  /**
   * A fixed preimage prefix.
   * https://github.com/bitcoin/bips/blob/master/bip-0340/reference.py#L25
   * taggedHash(tag, m) = sha256(sha256(tag) || sha256(tag) || m)
   *
   * https://github.com/bitcoin/bips/blob/master/bip-0341.mediawiki#common-signature-message
   * BIP-341 defines Common Signature Message, SigMsg(hash_type, ext_flag)
   *
   * https://github.com/bitcoin/bips/blob/master/bip-0342.mediawiki#common-signature-message-extension
   * BIP-342 defines tapscript message extension (ext) to BIP-341 Common Signature Message, indicated by ext_flag = 1:
   *   - tapLeafHash
   *   - keyVersion
   *   - codeSepPos
   *
   * hash type uses 0x00 (SIGHASH_DEFAULT), so the message `m` to checksig is
   *
   *     taggedHash('TapSighash', 0x00 || SigMsg(0x00, 1) || ext)
   *                               |              |    |
   *                        sighashEpoch     hashType  extFlag
   *
   * tagHash = sha256('TapSighash') = f40a48df4b2a70c8b4924bf2654661ed3d95fd66a313eb87237597c628e4a031
   *
   *  => sha256(tagHash || tagHash || 0x00 || SigMsg(0x00, 1) || ext)
   *
   * we define:
   *     preimage = SigMsg(0x00, 1) || ext
   *     preimagePrefix = tagHash || tagHash || 0x00
   */
  @prop()
  static readonly preimagePrefix: ByteString = toByteString(
    'f40a48df4b2a70c8b4924bf2654661ed3d95fd66a313eb87237597c628e4a031f40a48df4b2a70c8b4924bf2654661ed3d95fd66a313eb87237597c628e4a03100',
  );

  /**
   * A fixed preimage prefix.
   * https://github.com/bitcoin/bips/blob/master/bip-0340/reference.py#L114
   * e = taggedHash('BIP0340/challenge', bytes(R) || bytes(P) || m)
   *
   * tagHash = sha256('BIP0340/challenge') = 7bb52d7a9fef58323eb1bf7a407db382d2f3f2d81bb1224f49fe518f6d48d37c
   *
   * e = sha256(tagHash || tagHash || bytes(R) || bytes(P) || m)
   *
   * we define:
   *     ePreimagePrefix = tagHash || tagHash || bytes(R) || bytes(P)
   *
   * e = sha256(ePreimagePrefix || m)
   *
   * default signing process Sign(sk, m) defines in BIP-340
   * https://github.com/bitcoin/bips/blob/master/bip-0340.mediawiki#default-signing
   *
   * we use the private key sk = 1 to sign the message, so
   *   d' = 1
   *   d' is good in range (0, n)
   *   P = d'G = G
   *   has_even_y(P) = has_even_y(G) = True
   *   d = d' if has_even_y(P) = 1
   * and we do not derive k' to generate the random point R but use G directly
   *   k' = 1
   *   R = k'G = G
   *   has_even_y(R) = has_even_y(G) = True
   *   k = k' if has_even_y(R) = 1
   *
   * ePreimagePrefix = tagHash || tagHash || Gx || Gx
   */
  @prop()
  static readonly ePreimagePrefix: ByteString = toByteString(
    '7bb52d7a9fef58323eb1bf7a407db382d2f3f2d81bb1224f49fe518f6d48d37c7bb52d7a9fef58323eb1bf7a407db382d2f3f2d81bb1224f49fe518f6d48d37c79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f8179879be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798',
  );

  /**
   * sign the transaction preimage
   * @param shPreimage - the transaction preimage
   * @returns a signature
   */
  @method()
  static checkSHPreimage(_shPreimage: SHPreimage): Sig {
    // assert(len(shPreimage.nVersion) == 4n, 'invalid length of nVersion');
    // assert(len(shPreimage.nLockTime) == 4n, 'invalid length of nLockTime');
    // assert(len(shPreimage.shaPrevouts) == 32n, 'invalid length of shaPrevouts');
    // assert(len(shPreimage.shaSpentAmounts) == 32n, 'invalid length of shaSpentAmounts');
    // assert(len(shPreimage.shaSpentScripts) == 32n, 'invalid length of shaSpentScripts');
    // assert(len(shPreimage.shaSequences) == 32n, 'invalid length of shaSequences');
    // assert(len(shPreimage.shaOutputs) == 32n, 'invalid length of shaOutputs');
    // // spend_type (1): equal to (ext_flag * 2) + annex_present,
    // // where annex_present is 0 if no annex is present, or 1 otherwise.
    // // If there are at least two witness elements, and the first byte of the last element is 0x50,
    // // this last element is called annex.
    // // Until the meaning of this field is defined by another softfork,
    // // users SHOULD NOT include annex in transactions, or it may lead to PERMANENT FUND LOSS.
    // // BIP-342 defines the tapscript message extension ext to BIP341 Common Signature Message, indicated by ext_flag = 1,
    // // so spend_type here is always 0x02
    // assert(shPreimage.spendType == toByteString('02'), 'invalid spendType');
    // assert(len(shPreimage.inputIndex) == 4n, 'invalid length of inputIndex');
    // assert(len(shPreimage.tapLeafHash) == 32n, 'invalid length of tapLeafHash');
    // // key_verison is a constant value 0x00 defined in BIP-342
    // assert(shPreimage.keyVersion == toByteString('00'), 'invalid keyVersion');
    // // BIP-342
    // assert(len(shPreimage.codeSepPos) == 4n, 'invalid length of codeSepPos');

    // // according to the notation in BIP-342
    // // sigHash is the message m to validate the signature sig with public key p: Verify(p, m, sig)
    // const sigHash = sha256(
    //   ContextUtils.preimagePrefix +
    //     toByteString('00') + // hash type SIGHASH_DEFAULT
    //     shPreimage.nVersion +
    //     shPreimage.nLockTime +
    //     shPreimage.shaPrevouts +
    //     shPreimage.shaSpentAmounts +
    //     shPreimage.shaSpentScripts +
    //     shPreimage.shaSequences +
    //     shPreimage.shaOutputs +
    //     shPreimage.spendType +
    //     shPreimage.inputIndex +
    //     shPreimage.tapLeafHash +
    //     shPreimage.keyVersion +
    //     shPreimage.codeSepPos,
    // );
    // // e = sha256(ePreimagePrefix || m)
    // const e = sha256(ContextUtils.ePreimagePrefix + sigHash);

    // assert(len(shPreimage._eWithoutLastByte) == 31n, 'invalid length of _eWithoutLastByte');
    // assert(shPreimage._eLastByte < 127n, 'invalid _eLastByte');
    // const eLastByte =
    //   shPreimage._eLastByte == 0n ? toByteString('00') : int32ToByteString(shPreimage._eLastByte);
    // assert(e == shPreimage._eWithoutLastByte + eLastByte, 'invalid e');

    // d = 1
    // k = 1
    // R = G
    // sig = bytes(R) || bytes((k + ed) mod n)
    //     = Gx || bytes((1 + e) mod n)
    //        |            |
    //        r            s
    // we do not ensure e + 1 < n here, which ensured by the off-chain code
    // if the passed e + 1 >= n somehow, then it will fail when later checksig
    // const s =
    //   ContextUtils.Gx +
    //   shPreimage._eWithoutLastByte +
    //   int32ToByteString(shPreimage._eLastByte + 1n);
    return Sig('');
  }

  /**
   * Verify that the prevouts context passed in by the user is authentic
   * @param prevouts prevouts context passed in by the user that need to be verified
   * @param prevout prevout context passed in by the user that need to be verified
   * @param t_hashPrevouts hashPrevouts in preimage which is trustable
   * @param t_inputIndex the index of the input, which is trustable
   * @returns the number of inputs, which is trustable
   */
  @method()
  static checkPrevouts(
    prevouts: Prevouts,
    prevout: Outpoint,
    t_hashPrevouts: ByteString,
    t_inputIndex: UInt32,
  ): Int32 {
    // check prevouts
    assert(hash256(prevouts) == t_hashPrevouts, 'hashPrevouts mismatch');
    const inputCount = StdUtils.checkLenDivisibleBy(prevouts, 36n);
    assert(t_inputIndex < inputCount, 'invalid prevouts');

    // check prevout
    assert(
      (prevout.txHash + StdUtils.uint32ToByteString(prevout.outputIndex)) == slice(prevouts, t_inputIndex * 36n, (t_inputIndex + 1n) * 36n),
      'invalid prevout',
    );
    return inputCount;
  }

  /**
   * Check if the spent scripts array passed in matches the shaSpentScripts
   * @param spentScripts array of spent scripts passed in that need to be verified
   * @param t_hashSpentScripts the hash of the merged spent scripts, which comes from preimage and is trustable
   * @param t_inputCount must be trustable, the number of inputs
   */
  @method()
  static checkSpentScripts(
    spentScripts: SpentScriptHashes,
    t_hashSpentScripts: ByteString,
    t_inputCount: bigint,
  ): void {
    assert(hash256(spentScripts) == t_hashSpentScripts, 'hashSpentScripts mismatch');
    assert(t_inputCount == StdUtils.checkLenDivisibleBy(spentScripts, 32n), 'invalid spentScripts');
  }

  /**
   * Check if the spent amounts array passed in matches the shaSpentAmounts
   * @param spentAmounts array of spent amounts passed in that need to be verified
   * @param t_hashSpentAmounts the hash of the merged spent amounts, which comes from preimage and is trustable
   * @param t_inputCount must be trustable, the number of inputs
   */
  @method()
  static checkSpentAmounts(
    spentAmounts: SpentAmounts,
    t_hashSpentAmounts: ByteString,
    t_inputCount: bigint,
  ): void {
    assert(hash256(spentAmounts) == t_hashSpentAmounts, 'hashSpentAmounts mismatch');
    assert(t_inputCount == StdUtils.checkLenDivisibleBy(spentAmounts, 8n), 'invalid spentAmounts');
  }
}
