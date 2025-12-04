import {
  FixedArray,
  TxOut,
  toByteString,
  TxUtils,
  assert,
  SmartContract,
  method,
  tags,
  len,
  slice,
} from '@opcat-labs/scrypt-ts-opcat';


/**
 * Maximum number of inputs to check during genesis deployment
 */
export const MAX_GENESIS_CHECK_INPUT = 6;

/**
 * Maximum number of outputs to check during genesis deployment
 */
export const MAX_GENESIS_CHECK_OUTPUT = 6;

/**
 * Genesis contract for validating initial deployment outputs.
 *
 * This contract ensures that during deployment:
 * 1. Genesis is unlocked at input index 0
 * 2. The contract at output[0] has a unique scriptHash among all outputs
 * 3. The contract at output[0] has a different scriptHash from all inputs
 *
 * Empty scriptHashes (represented by empty ByteString) are treated as placeholders
 * and are not validated for uniqueness.
 *
 * @category Contract
 * @category Genesis
 * @onchain
 */
@tags(['GENESIS'])
export class Genesis extends SmartContract {
  constructor() {
    // eslint-disable-next-line prefer-rest-params
    super(...arguments);
  }

  /**
   * Validates the deployment transaction outputs.
   *
   * This method performs the following checks:
   * 1. Verifies Genesis is unlocked at input index 0
   * 2. Serializes all non-empty output data (scriptHash, satoshis, dataHash)
   * 3. Ensures output[0] scriptHash is non-empty
   * 4. Ensures output[0] scriptHash is different from all input scriptHashes
   * 5. Ensures output[0] scriptHash is unique among all outputs
   * 6. Verifies the serialized outputs match the transaction context
   *
   * Empty scriptHashes (len == 0) are treated as placeholders and are skipped
   * in both serialization and uniqueness validation.
   *
   * @param outputs - Fixed array of 6 transaction outputs to validate
   * @throws {Error} If Genesis is not at input index 0
   * @throws {Error} If output[0] scriptHash is empty
   * @throws {Error} If output[0] has the same scriptHash as any input
   * @throws {Error} If output[0] has the same scriptHash as any other output
   * @throws {Error} If outputs don't match the transaction context
   * @onchain
   */
  @method()
  public checkDeploy(outputs: FixedArray<TxOut, typeof MAX_GENESIS_CHECK_OUTPUT>) {

    // Ensure Genesis is unlocked at input index 0
    assert(this.ctx.inputIndex == 0n, 'Genesis must be unlocked at input index 0');

    // Ensure input count does not exceed the maximum we can check
    // This prevents attackers from placing duplicate scriptHashes at unchecked input indices
    assert(this.ctx.inputCount <= BigInt(MAX_GENESIS_CHECK_INPUT), 'Too many inputs to validate');

    // Serialize all outputs
    let outputBytes = toByteString('');
    for (let index = 0; index < MAX_GENESIS_CHECK_OUTPUT; index++) {
      const _output = outputs[index];
      if (len(_output.scriptHash) > 0n) {
        outputBytes += TxUtils.buildDataOutput(
          _output.scriptHash,
          _output.satoshis,
          _output.dataHash,
        );
      }
    }

    // Ensure output[0] scriptHash is non-empty
    const output0ScriptHash = outputs[0].scriptHash;
    assert(len(output0ScriptHash) > 0n);

    // Ensure output[0] scriptHash is different from all input scriptHashes
    // This prevents deploying a contract that matches any input contract
    let start = 0n;
    for (let index = 0; index < MAX_GENESIS_CHECK_INPUT; index++) {
      if (index < this.ctx.inputCount) {
        const inputScriptHash = slice(this.ctx.spentScriptHashes, start, start + 32n);
        assert(output0ScriptHash != inputScriptHash);
        start += 32n;
      }
    }

    // Ensure output[0] scriptHash is unique (not equal to any other output's scriptHash)
    if (len(outputs[1].scriptHash) > 0n) {
      assert(output0ScriptHash != outputs[1].scriptHash);
    }
    if (len(outputs[2].scriptHash) > 0n) {
      assert(output0ScriptHash != outputs[2].scriptHash);
    }
    if (len(outputs[3].scriptHash) > 0n) {
      assert(output0ScriptHash != outputs[3].scriptHash);
    }
    if (len(outputs[4].scriptHash) > 0n) {
      assert(output0ScriptHash != outputs[4].scriptHash);
    }
    if (len(outputs[5].scriptHash) > 0n) {
      assert(output0ScriptHash != outputs[5].scriptHash);
    }

    // Verify outputs match the transaction context
    assert(this.checkOutputs(outputBytes), 'Outputs mismatch with the transaction context');
  }
}
