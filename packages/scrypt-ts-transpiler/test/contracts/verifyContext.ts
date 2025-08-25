import {
  SmartContract,
  method,
  assert,
  ByteString,
  ContextUtils,
  FixedArray,
  Int32,
  TxUtils,
  len,
  sha256,
  toByteString,
  hash256,
  hash160,
} from '@opcat-labs/scrypt-ts';

  const TX_INPUT_COUNT_MAX = 6;
  const TX_OUTPUT_COUNT_MAX = 6;
export class VerifyContext extends SmartContract {
  @method()
  public unlock(
    nLockTime: Int32,
    sequences: FixedArray<ByteString, typeof TX_INPUT_COUNT_MAX>, // uint32string array
    inputCount: Int32,
    currentInputIndex: Int32,
    outputScriptListExceptChange: FixedArray<ByteString, typeof TX_OUTPUT_COUNT_MAX>,
    outputSatoshisListExceptChange: FixedArray<Int32, typeof TX_OUTPUT_COUNT_MAX>,
  ) {
    // verify this.ctx.nVersion
    assert(this.ctx.nVersion === toByteString('02000000'), 'nVersion is not 2');

    // verify this.ctx.nLockTime
    assert(this.ctx.nLockTime === nLockTime, 'nLockTime is not correct');

    // verify this.ctx.shaPrevouts and Prevouts
    ContextUtils.checkPrevouts(
      this.ctx.prevouts,
      this.ctx.hashPrevouts,
      this.ctx.inputIndex,
      this.ctx.inputCount,
    );

    // verify this.ctx.hashSpentAmounts and SpentAmounts
    {
      assert(hash256(this.ctx.spentAmounts) === this.ctx.hashSpentAmounts, 'hashSpentAmounts is not correct');
    }

    // verify this.ctx.hashSpentDataHashes and SpentScripts
    ContextUtils.checkSpentScripts(this.ctx.spentScriptHashes, this.ctx.hashSpentDataHashes, inputCount);
    {

      assert(
        hash256(this.ctx.spentScriptHashes) === this.ctx.hashSpentScriptHashes,
        'hashSpentScriptHashes is not correct',
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
      assert(this.ctx.hashSequences === hash160(mergedSequences), 'shaSequences is not correct');
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
      assert(sha256(mergedOutputs) === this.ctx.hashOutputs, 'shaOutputs is not correct');
    }


    // verify this.ctx.inputIndex
    assert(this.ctx.inputIndex === currentInputIndex, 'inputIndex is not correct');

    // verify this.ctx.tapLeafHash.
    // we can not verify it here, because we cannot access information about the control block or the taproot key.
    // and for the contract writer, there is no use case to use this.ctx.tapLeafHash.
    // the field is only used in the checkSHPreimage method.

    // verify keyVersion, constant value 0x00
    assert(this.ctx.nLockTime === 0n, 'keyVersion is not correct');

  }
}
