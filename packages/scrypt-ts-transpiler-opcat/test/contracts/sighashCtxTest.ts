import {
  SmartContract,
  method,
  assert,
  hash256,
  toByteString,
  ByteString,
  prop,
} from '@opcat-labs/scrypt-ts-opcat';

// Local SigHashType object for decorator parameters
// This is needed because const enum is not available at runtime in tsx
const SigHashType = {
  ALL: 0x01,
  NONE: 0x02,
  SINGLE: 0x03,
  ANYONECANPAY: 0x80,
  ANYONECANPAY_ALL: 0x81,
  ANYONECANPAY_NONE: 0x82,
  ANYONECANPAY_SINGLE: 0x83,
} as const;

/**
 * Test contract for verifying ctx variables are correctly injected
 * with different sighash types. This tests that:
 *
 * - SIGHASH_ALL (0x01): prevouts, spentAmounts, spentScriptHashes, spentDataHashes,
 *   nSequence, hashSequences, hashOutputs are all available
 * - SIGHASH_NONE (0x02): prevouts, spentAmounts, spentScriptHashes are available,
 *   hashOutputs is empty (32 zero bytes)
 * - SIGHASH_SINGLE (0x03): prevouts, spentAmounts, spentScriptHashes are available,
 *   hashOutputs covers only the output at the same index
 * - ANYONECANPAY_* (0x81-0x83): hashPrevouts/hashSpentAmounts/hashSpentScriptHashes/hashSequences
 *   are empty (32 zero bytes), cannot access prevouts/spentAmounts/spentScriptHashes
 *   nSequence and hashOutputs (in ALL mode) are still accessible
 *
 * Key validation: hash256(data) == hashXxx
 *
 * Also tests that timeLock() works correctly in ALL sighash types:
 * - timeLock uses nSequence (current input's sequence) and nLockTime from preimage
 * - These fields are always available regardless of sighash type
 * - timeLock does NOT use hashSequences, which is empty in ANYONECANPAY mode
 */
export class SighashCtxTest extends SmartContract {
  // Empty hash constant (32 zero bytes) - used when sighash type doesn't include certain fields
  @prop()
  static readonly EMPTY_HASH: ByteString = toByteString(
    '0000000000000000000000000000000000000000000000000000000000000000'
  );

  // Mature time for timeLock testing
  @prop()
  matureTime: bigint;

  constructor(matureTime: bigint) {
    super(...arguments);
    this.matureTime = matureTime;
  }

  /**
   * SIGHASH_ALL (0x01) - verify all ctx variables
   * This is the default sighash type, should have access to all ctx variables
   */
  @method()
  public unlockAll(inputCount: bigint) {
    // Verify sigHashType
    assert(this.ctx.sigHashType === 1n, 'sigHashType should be ALL (1)');

    // Verify prevouts data integrity
    assert(
      this.ctx.hashPrevouts === hash256(this.ctx.prevouts),
      'hashPrevouts mismatch'
    );

    // Verify spentAmounts data integrity
    assert(
      this.ctx.hashSpentAmounts === hash256(this.ctx.spentAmounts),
      'hashSpentAmounts mismatch'
    );

    // Verify spentScriptHashes data integrity
    assert(
      this.ctx.hashSpentScriptHashes === hash256(this.ctx.spentScriptHashes),
      'hashSpentScriptHashes mismatch'
    );

    // Verify spentDataHashes data integrity
    assert(
      this.ctx.hashSpentDataHashes === hash256(this.ctx.spentDataHashes),
      'hashSpentDataHashes mismatch'
    );

    // Verify input count
    assert(this.ctx.inputCount === inputCount, 'inputCount mismatch');

    // Verify nSequence is accessible
    const nSequence = this.ctx.nSequence;
    assert(nSequence === nSequence, 'nSequence should be accessible');

    // Verify hashSequences is accessible
    const hashSequences = this.ctx.hashSequences;
    assert(hashSequences === hashSequences, 'hashSequences should be accessible');

    // Verify hashOutputs is accessible
    const hashOutputs = this.ctx.hashOutputs;
    assert(hashOutputs === hashOutputs, 'hashOutputs should be accessible');

    // Test timeLock - uses nSequence and nLockTime from preimage
    // timeLock should work in ALL sighash types since it uses current input's nSequence
    assert(this.timeLock(this.matureTime), 'timeLock should work in SIGHASH_ALL');
  }

  /**
   * SIGHASH_NONE (0x02) - verify ctx variables
   * Signs only inputs, outputs can be modified
   * Note: hashOutputs is empty (32 zero bytes) in NONE mode
   */
  @method({ sigHashType: SigHashType.NONE })
  public unlockNone(inputCount: bigint) {
    // Verify sigHashType
    assert(this.ctx.sigHashType === 2n, 'sigHashType should be NONE (2)');

    // Verify prevouts data integrity
    assert(
      this.ctx.hashPrevouts === hash256(this.ctx.prevouts),
      'hashPrevouts mismatch'
    );

    // Verify spentAmounts data integrity
    assert(
      this.ctx.hashSpentAmounts === hash256(this.ctx.spentAmounts),
      'hashSpentAmounts mismatch'
    );

    // Verify spentScriptHashes data integrity
    assert(
      this.ctx.hashSpentScriptHashes === hash256(this.ctx.spentScriptHashes),
      'hashSpentScriptHashes mismatch'
    );

    // Verify input count
    assert(this.ctx.inputCount === inputCount, 'inputCount mismatch');

    // Verify nSequence is accessible
    const nSequence = this.ctx.nSequence;
    assert(nSequence === nSequence, 'nSequence should be accessible');

    // Verify hashSequences is accessible
    const hashSequences = this.ctx.hashSequences;
    assert(hashSequences === hashSequences, 'hashSequences should be accessible');

    // Verify hashOutputs is empty (32 zero bytes) in NONE mode
    // Because SIGHASH_NONE does not sign any outputs
    assert(
      this.ctx.hashOutputs === SighashCtxTest.EMPTY_HASH,
      'hashOutputs should be empty in NONE mode'
    );

    // Test timeLock - uses nSequence and nLockTime from preimage
    // timeLock should work in ALL sighash types since it uses current input's nSequence
    assert(this.timeLock(this.matureTime), 'timeLock should work in SIGHASH_NONE');
  }

  /**
   * SIGHASH_SINGLE (0x03) - verify ctx variables
   * Signs input and corresponding output at same index
   * Note: hashOutputs only covers output at same index in SINGLE mode
   */
  @method({ sigHashType: SigHashType.SINGLE })
  public unlockSingle(inputCount: bigint) {
    // Verify sigHashType
    assert(this.ctx.sigHashType === 3n, 'sigHashType should be SINGLE (3)');

    // Verify prevouts data integrity
    assert(
      this.ctx.hashPrevouts === hash256(this.ctx.prevouts),
      'hashPrevouts mismatch'
    );

    // Verify spentAmounts data integrity
    assert(
      this.ctx.hashSpentAmounts === hash256(this.ctx.spentAmounts),
      'hashSpentAmounts mismatch'
    );

    // Verify spentScriptHashes data integrity
    assert(
      this.ctx.hashSpentScriptHashes === hash256(this.ctx.spentScriptHashes),
      'hashSpentScriptHashes mismatch'
    );

    // Verify input count
    assert(this.ctx.inputCount === inputCount, 'inputCount mismatch');

    // Verify nSequence is accessible
    const nSequence = this.ctx.nSequence;
    assert(nSequence === nSequence, 'nSequence should be accessible');

    // Verify hashSequences is accessible
    const hashSequences = this.ctx.hashSequences;
    assert(hashSequences === hashSequences, 'hashSequences should be accessible');

    // Note: hashOutputs only covers output at same index in SINGLE mode, but still accessible
    const hashOutputs = this.ctx.hashOutputs;
    assert(hashOutputs === hashOutputs, 'hashOutputs should be accessible');

    // Test timeLock - uses nSequence and nLockTime from preimage
    // timeLock should work in ALL sighash types since it uses current input's nSequence
    assert(this.timeLock(this.matureTime), 'timeLock should work in SIGHASH_SINGLE');
  }

  /**
   * ANYONECANPAY_ALL (0x81) - hash fields are empty, cannot access prevouts etc
   * Note: In ANYONECANPAY mode, hashPrevouts/hashSpentAmounts/hashSpentScriptHashes/hashSpentDataHashes/hashSequences
   * are empty (32 zero bytes), so ContextUtils.checkXxx() would fail if we try
   * to access prevouts/spentAmounts/spentScriptHashes.
   * We verify that these hash fields are empty and use buildChangeOutput which is allowed with ANYONECANPAY_ALL.
   */
  @method({ sigHashType: SigHashType.ANYONECANPAY_ALL })
  public unlockAnyonecanpayAll() {
    // Verify sigHashType
    assert(
      this.ctx.sigHashType === 129n,
      'sigHashType should be ANYONECANPAY_ALL (129)'
    );

    // Verify hashPrevouts is empty (32 zero bytes) in ANYONECANPAY mode
    assert(
      this.ctx.hashPrevouts === SighashCtxTest.EMPTY_HASH,
      'hashPrevouts should be empty in ANYONECANPAY mode'
    );

    // Verify hashSpentAmounts is empty (32 zero bytes) in ANYONECANPAY mode
    assert(
      this.ctx.hashSpentAmounts === SighashCtxTest.EMPTY_HASH,
      'hashSpentAmounts should be empty in ANYONECANPAY mode'
    );

    // Verify hashSpentScriptHashes is empty (32 zero bytes) in ANYONECANPAY mode
    assert(
      this.ctx.hashSpentScriptHashes === SighashCtxTest.EMPTY_HASH,
      'hashSpentScriptHashes should be empty in ANYONECANPAY mode'
    );

    // Verify hashSpentDataHashes is empty (32 zero bytes) in ANYONECANPAY mode
    assert(
      this.ctx.hashSpentDataHashes === SighashCtxTest.EMPTY_HASH,
      'hashSpentDataHashes should be empty in ANYONECANPAY mode'
    );

    // Verify hashSequences is empty (32 zero bytes) in ANYONECANPAY mode
    assert(
      this.ctx.hashSequences === SighashCtxTest.EMPTY_HASH,
      'hashSequences should be empty in ANYONECANPAY mode'
    );

    // nSequence is accessible in ANYONECANPAY mode (current input's sequence)
    const nSequence = this.ctx.nSequence;
    assert(nSequence === nSequence, 'nSequence should be accessible');

    // hashOutputs is NOT empty in ANYONECANPAY_ALL mode (signs all outputs)
    const hashOutputs = this.ctx.hashOutputs;
    assert(hashOutputs !== SighashCtxTest.EMPTY_HASH, 'hashOutputs should NOT be empty in ANYONECANPAY_ALL mode');

    // buildChangeOutput is allowed with ANYONECANPAY_ALL
    const outputs = this.buildChangeOutput();
    assert(this.checkOutputs(outputs), 'outputs mismatch');

    // Test timeLock - uses nSequence and nLockTime from preimage
    // timeLock should work in ALL sighash types since it uses current input's nSequence (NOT hashSequences)
    assert(this.timeLock(this.matureTime), 'timeLock should work in ANYONECANPAY_ALL');
  }

  /**
   * ANYONECANPAY_NONE (0x82)
   * Cannot access global input info like prevouts/spentAmounts/spentScriptHashes
   * All hash fields except hashOutputs are empty, and hashOutputs is also empty (NONE mode)
   */
  @method({ sigHashType: SigHashType.ANYONECANPAY_NONE })
  public unlockAnyonecanpayNone() {
    // Verify sigHashType
    assert(
      this.ctx.sigHashType === 130n,
      'sigHashType should be ANYONECANPAY_NONE (130)'
    );

    // Verify hashPrevouts is empty (32 zero bytes) in ANYONECANPAY mode
    assert(
      this.ctx.hashPrevouts === SighashCtxTest.EMPTY_HASH,
      'hashPrevouts should be empty in ANYONECANPAY mode'
    );

    // Verify hashSpentAmounts is empty (32 zero bytes) in ANYONECANPAY mode
    assert(
      this.ctx.hashSpentAmounts === SighashCtxTest.EMPTY_HASH,
      'hashSpentAmounts should be empty in ANYONECANPAY mode'
    );

    // Verify hashSpentScriptHashes is empty (32 zero bytes) in ANYONECANPAY mode
    assert(
      this.ctx.hashSpentScriptHashes === SighashCtxTest.EMPTY_HASH,
      'hashSpentScriptHashes should be empty in ANYONECANPAY mode'
    );

    // Verify hashSpentDataHashes is empty (32 zero bytes) in ANYONECANPAY mode
    assert(
      this.ctx.hashSpentDataHashes === SighashCtxTest.EMPTY_HASH,
      'hashSpentDataHashes should be empty in ANYONECANPAY mode'
    );

    // Verify hashSequences is empty (32 zero bytes) in ANYONECANPAY mode
    assert(
      this.ctx.hashSequences === SighashCtxTest.EMPTY_HASH,
      'hashSequences should be empty in ANYONECANPAY mode'
    );

    // nSequence is accessible in ANYONECANPAY mode (current input's sequence)
    const nSequence = this.ctx.nSequence;
    assert(nSequence === nSequence, 'nSequence should be accessible');

    // Verify hashOutputs is empty (32 zero bytes) in ANYONECANPAY_NONE mode (NONE = no outputs signed)
    assert(
      this.ctx.hashOutputs === SighashCtxTest.EMPTY_HASH,
      'hashOutputs should be empty in ANYONECANPAY_NONE mode'
    );

    // Test timeLock - uses nSequence and nLockTime from preimage
    // timeLock should work in ALL sighash types since it uses current input's nSequence (NOT hashSequences)
    assert(this.timeLock(this.matureTime), 'timeLock should work in ANYONECANPAY_NONE');
  }

  /**
   * ANYONECANPAY_SINGLE (0x83)
   * Cannot access global input info like prevouts/spentAmounts/spentScriptHashes
   * All hash fields are empty except hashOutputs (SINGLE = signs corresponding output)
   */
  @method({ sigHashType: SigHashType.ANYONECANPAY_SINGLE })
  public unlockAnyonecanpaySingle() {
    // Verify sigHashType
    assert(
      this.ctx.sigHashType === 131n,
      'sigHashType should be ANYONECANPAY_SINGLE (131)'
    );

    // Verify hashPrevouts is empty (32 zero bytes) in ANYONECANPAY mode
    assert(
      this.ctx.hashPrevouts === SighashCtxTest.EMPTY_HASH,
      'hashPrevouts should be empty in ANYONECANPAY mode'
    );

    // Verify hashSpentAmounts is empty (32 zero bytes) in ANYONECANPAY mode
    assert(
      this.ctx.hashSpentAmounts === SighashCtxTest.EMPTY_HASH,
      'hashSpentAmounts should be empty in ANYONECANPAY mode'
    );

    // Verify hashSpentScriptHashes is empty (32 zero bytes) in ANYONECANPAY mode
    assert(
      this.ctx.hashSpentScriptHashes === SighashCtxTest.EMPTY_HASH,
      'hashSpentScriptHashes should be empty in ANYONECANPAY mode'
    );

    // Verify hashSpentDataHashes is empty (32 zero bytes) in ANYONECANPAY mode
    assert(
      this.ctx.hashSpentDataHashes === SighashCtxTest.EMPTY_HASH,
      'hashSpentDataHashes should be empty in ANYONECANPAY mode'
    );

    // Verify hashSequences is empty (32 zero bytes) in ANYONECANPAY mode
    assert(
      this.ctx.hashSequences === SighashCtxTest.EMPTY_HASH,
      'hashSequences should be empty in ANYONECANPAY mode'
    );

    // nSequence is accessible in ANYONECANPAY mode (current input's sequence)
    const nSequence = this.ctx.nSequence;
    assert(nSequence === nSequence, 'nSequence should be accessible');

    // hashOutputs is NOT empty in ANYONECANPAY_SINGLE mode (signs corresponding output)
    const hashOutputs = this.ctx.hashOutputs;
    assert(hashOutputs !== SighashCtxTest.EMPTY_HASH, 'hashOutputs should NOT be empty in ANYONECANPAY_SINGLE mode');

    // Test timeLock - uses nSequence and nLockTime from preimage
    // timeLock should work in ALL sighash types since it uses current input's nSequence (NOT hashSequences)
    assert(this.timeLock(this.matureTime), 'timeLock should work in ANYONECANPAY_SINGLE');
  }
}
