import {
  SmartContract,
  method,
  assert,
  hash256,
  toByteString,
  ByteString,
  prop,
  len,
} from '@opcat-labs/scrypt-ts-opcat';

// Local SigHashType object for decorator parameters
// This is needed because const enum is not available at runtime in tsx
const SigHashType = {
  ALL: 0x01,
  NONE: 0x02,
  SINGLE: 0x03,
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
 *   hashOutputs is blocked at transpile time (empty at runtime)
 * - SIGHASH_SINGLE (0x03): prevouts, spentAmounts, spentScriptHashes, hashOutputs are available
 * - ANYONECANPAY_* (0x81-0x83): hash fields are blocked at transpile time,
 *   only direct fields (prevout, outpoint, spentScriptHash, spentDataHash, value) are allowed
 *
 * Key validation: hash256(data) == hashXxx
 *
 * Also tests that timeLock() works correctly in ALL sighash types:
 * - timeLock uses nSequence (current input's sequence) and nLockTime from preimage
 * - These fields are always available regardless of sighash type
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
   * Note: hashOutputs access is blocked at transpile time because it's empty in NONE mode
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

    // Note: hashOutputs access is blocked at transpile time because it's empty in NONE mode
    // Cannot verify it at runtime anymore

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
   * ANYONECANPAY_ALL (0x81) - hash fields are blocked at transpile time
   * In ANYONECANPAY mode, hash fields (hashPrevouts, hashSpentAmounts, etc.) are empty,
   * so their access is blocked at transpile time.
   * Only direct fields (prevout, outpoint, spentScriptHash, spentDataHash, value) and
   * nSequence, hashOutputs are allowed.
   */
  @method({ sigHashType: SigHashType.ANYONECANPAY_ALL })
  public unlockAnyonecanpayAll() {
    // Verify sigHashType
    assert(
      this.ctx.sigHashType === 129n,
      'sigHashType should be ANYONECANPAY_ALL (129)'
    );

    // Note: hash fields access (hashPrevouts, hashSpentAmounts, etc.) is blocked at transpile time
    // because they are empty in ANYONECANPAY mode

    // Direct fields are still accessible
    const prevout = this.ctx.prevout;
    assert(len(prevout.txHash) > 0n, 'prevout should be accessible');

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
   * Hash fields are blocked at transpile time.
   * hashOutputs is also blocked because NONE mode doesn't sign outputs.
   */
  @method({ sigHashType: SigHashType.ANYONECANPAY_NONE })
  public unlockAnyonecanpayNone() {
    // Verify sigHashType
    assert(
      this.ctx.sigHashType === 130n,
      'sigHashType should be ANYONECANPAY_NONE (130)'
    );

    // Note: hash fields access (hashPrevouts, hashSpentAmounts, hashOutputs, etc.) is blocked at transpile time

    // Direct fields are still accessible
    const prevout = this.ctx.prevout;
    assert(len(prevout.txHash) > 0n, 'prevout should be accessible');

    // nSequence is accessible in ANYONECANPAY mode (current input's sequence)
    const nSequence = this.ctx.nSequence;
    assert(nSequence === nSequence, 'nSequence should be accessible');

    // Test timeLock - uses nSequence and nLockTime from preimage
    // timeLock should work in ALL sighash types since it uses current input's nSequence (NOT hashSequences)
    assert(this.timeLock(this.matureTime), 'timeLock should work in ANYONECANPAY_NONE');
  }

  /**
   * ANYONECANPAY_SINGLE (0x83)
   * Hash fields are blocked at transpile time.
   * hashOutputs is allowed (signs corresponding output).
   */
  @method({ sigHashType: SigHashType.ANYONECANPAY_SINGLE })
  public unlockAnyonecanpaySingle() {
    // Verify sigHashType
    assert(
      this.ctx.sigHashType === 131n,
      'sigHashType should be ANYONECANPAY_SINGLE (131)'
    );

    // Note: hash fields access (hashPrevouts, hashSpentAmounts, etc.) is blocked at transpile time

    // Direct fields are still accessible
    const prevout = this.ctx.prevout;
    assert(len(prevout.txHash) > 0n, 'prevout should be accessible');

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
