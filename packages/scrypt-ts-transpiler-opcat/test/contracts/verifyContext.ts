import {
  SmartContract,
  method,
  assert,
  ByteString,
  ContextUtils,
  FixedArray,
  Int32,
  TX_INPUT_COUNT_MAX,
  TX_OUTPUT_COUNT_MAX,
  TxUtils,
  int32ToByteString,
  len,
  sha256,
  toByteString,
} from '@scrypt-inc/scrypt-ts-btc';

export class VerifyContext extends SmartContract {
  @method()
  public unlock(
    nLockTime: ByteString,
    sequences: FixedArray<ByteString, typeof TX_INPUT_COUNT_MAX>, // uint32string array
    inputCount: Int32,
    currentInputIndex: Int32,
    outputScriptListExceptChange: FixedArray<ByteString, typeof TX_OUTPUT_COUNT_MAX>,
    outputSatoshisListExceptChange: FixedArray<ByteString, typeof TX_OUTPUT_COUNT_MAX>,
  ) {
    // verify this.ctx.nVersion
    assert(this.ctx.nVersion === toByteString('02000000'), 'nVersion is not 2');

    // verify this.ctx.nLockTime
    assert(this.ctx.nLockTime === nLockTime, 'nLockTime is not correct');

    // verify this.ctx.shaPrevouts and Prevouts
    ContextUtils.checkPrevouts(
      this.ctx.prevouts,
      this.ctx.prevout,
      this.ctx.shaPrevouts,
      this.ctx.inputIndexVal,
    );

    // verify this.ctx.shaSpentAmounts and SpentAmounts
    {
      let spentAmounts = toByteString('');
      for (let index = 0; index < TX_INPUT_COUNT_MAX; index++) {
        if (index < inputCount) {
          spentAmounts += this.ctx.spentAmounts[index];
        } else {
          assert(len(this.ctx.spentAmounts[index]) === 0n, 'spentAmount length is not 0');
        }
      }
      assert(sha256(spentAmounts) === this.ctx.shaSpentAmounts, 'shaSpentAmounts is not correct');
    }

    // verify this.ctx.shaSpentScripts and SpentScripts
    ContextUtils.checkSpentScripts(this.ctx.spentScripts, this.ctx.shaSpentScripts, inputCount);
    {
      let mergedSpentScripts = toByteString('');
      for (let index = 0; index < TX_INPUT_COUNT_MAX; index++) {
        if (index < inputCount) {
          mergedSpentScripts =
            mergedSpentScripts +
            int32ToByteString(len(this.ctx.spentScripts[index])) +
            this.ctx.spentScripts[index];
        } else {
          assert(len(this.ctx.spentScripts[index]) === 0n, 'spentScript length is not 0');
        }
      }
      assert(
        sha256(mergedSpentScripts) === this.ctx.shaSpentScripts,
        'shaSpentScripts is not correct',
      );
    }

    // verify this.ctx.shaSequences, sequences
    {
      let mergedSequences = toByteString('');
      for (let index = 0; index < TX_INPUT_COUNT_MAX; index++) {
        const sequence = sequences[index];
        if (index < inputCount) {
          assert(len(sequence) === 4n, 'sequence length is not 4');
        } else {
          assert(len(sequence) === 0n, 'sequence length is not 0');
        }
        mergedSequences += sequence;
      }
      assert(this.ctx.shaSequences === sha256(mergedSequences), 'shaSequences is not correct');
    }

    // verify this.ctx.shaOutputs
    {
      let mergedOutputs = toByteString('');
      for (let index = 0; index < TX_OUTPUT_COUNT_MAX; index++) {
        if (index < inputCount - 1n) {
          mergedOutputs += TxUtils.buildOutput(
            outputScriptListExceptChange[index],
            outputSatoshisListExceptChange[index],
          );
        }
      }
      mergedOutputs += this.buildChangeOutput();
      assert(sha256(mergedOutputs) === this.ctx.shaOutputs, 'shaOutputs is not correct');
    }

    // verify this.ctx.spendType
    // @note since we are using tapLeafHash, not using annex, so the value of spendType is 2n
    assert(this.ctx.spendType === toByteString('02'), 'spendType is not correct');

    // verify this.ctx.inputIndex
    assert(this.ctx.inputIndexVal === currentInputIndex, 'inputIndexVal is not correct');
    TxUtils.checkIndex(currentInputIndex, this.ctx.inputIndex);

    // verify this.ctx.tapLeafHash.
    // we can not verify it here, because we cannot access information about the control block or the taproot key.
    // and for the contract writer, there is no use case to use this.ctx.tapLeafHash.
    // the field is only used in the checkSHPreimage method.

    // verify keyVersion, constant value 0x00
    assert(this.ctx.keyVersion === toByteString('00'), 'keyVersion is not correct');

    // verify codeSepPos
    // current we are not using codeSepPos, so the value of codeSepPos is 0xffffffff
    assert(this.ctx.codeSepPos === toByteString('ffffffff'), 'codeSepPos is not correct');

    // this.ctx._e and  this.ctx.eLastByte, are verify by checkSig at @link ./src/methods/checkSHPreimage.ts
  }
}
