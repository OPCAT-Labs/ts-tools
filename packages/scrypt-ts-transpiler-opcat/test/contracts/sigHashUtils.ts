import {
  assert,
  prop,
  method,
  int32ToByteString,
  toByteString,
  sha256,
  ByteString,
  Prevouts,
  PubKey,
  SHPreimage,
  Sig,
  SmartContractLib,
  SpentScripts,
  TxUtils,
  Int32,
  Outpoint,
} from '@scrypt-inc/scrypt-ts-btc';

export class SigHashUtils extends SmartContractLib {
  // Data for checking sighash preimage:
  @prop()
  static readonly Gx: PubKey = PubKey(
    toByteString('79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798'),
  );
  @prop()
  static readonly ePreimagePrefix: ByteString = toByteString(
    '7bb52d7a9fef58323eb1bf7a407db382d2f3f2d81bb1224f49fe518f6d48d37c7bb52d7a9fef58323eb1bf7a407db382d2f3f2d81bb1224f49fe518f6d48d37c79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f8179879be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798',
  ); // TAG_HASH + TAG_HASH + Gx + Gx
  @prop()
  static readonly preimagePrefix: ByteString = toByteString(
    'f40a48df4b2a70c8b4924bf2654661ed3d95fd66a313eb87237597c628e4a031f40a48df4b2a70c8b4924bf2654661ed3d95fd66a313eb87237597c628e4a0310000',
  ); // TAPSIGHASH + TAPSIGHASH + PREIMAGE_SIGHASH + PREIMAGE_EPOCH

  @method()
  static checkSHPreimage(shPreimage: SHPreimage): Sig {
    const sigHash = sha256(
      SigHashUtils.preimagePrefix +
        shPreimage.nVersion +
        shPreimage.nLockTime +
        shPreimage.shaPrevouts +
        shPreimage.shaSpentAmounts +
        shPreimage.shaSpentScripts +
        shPreimage.shaSequences +
        shPreimage.shaOutputs +
        shPreimage.spendType +
        shPreimage.inputIndex +
        shPreimage.tapLeafHash +
        shPreimage.keyVersion +
        shPreimage.codeSepPos,
    );

    const e = sha256(SigHashUtils.ePreimagePrefix + sigHash);
    assert(shPreimage._eLastByte < 127n, 'invalid value of _e');
    const eLastByte =
      shPreimage._eLastByte == 0n ? toByteString('00') : int32ToByteString(shPreimage._eLastByte);
    assert(e == shPreimage._eWithoutLastByte + eLastByte, 'invalid value of _e');
    const s =
      SigHashUtils.Gx +
      shPreimage._eWithoutLastByte +
      int32ToByteString(shPreimage._eLastByte + 1n);
    //assert(this.checkSig(Sig(s), SigHashUtils.Gx)) TODO (currently done outside)
    return Sig(s);
  }

  @method()
  static checkPrevouts(
    prevouts: Prevouts,
    inputIndex: ByteString, // from verified preimage
    inputIndexVal: Int32,
    shaPrevouts: ByteString,
    prevout: Outpoint,
  ): boolean {
    // check prevouts
    assert(sha256(TxUtils.mergePrevouts(prevouts).prevouts) == shaPrevouts, 'shaPrevouts mismatch');
    // check input index
    TxUtils.checkIndex(inputIndexVal, inputIndex);
    // check prevout
    assert(
      prevouts[Number(inputIndexVal)] == prevout.txHash + prevout.outputIndex,
      // 'input outpoint mismatch'
    );
    return true;
  }

  @method()
  static checkSpentScripts(
    spentScripts: SpentScripts,
    inputCount: Int32,
    shaSpentScripts: ByteString,
  ): boolean {
    // check spent scripts
    assert(
      sha256(TxUtils.mergeSpentScripts(spentScripts, inputCount)) == shaSpentScripts,
      'shaSpentScripts mismatch',
    );
    return true;
  }
}
