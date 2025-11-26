import { SmartContract } from '../smartContract.js';
import { method, tags } from '../decorators.js';
import { assert, toByteString, len } from '../fns/index.js';
import { FixedArray, TxOut } from '../types/index.js';
import { TxUtils } from './txUtils.js';
import { ContextUtils } from './contextUtils.js'

/**
 * Maximum number of outputs to check during genesis deployment
 */
export const MAX_GENESIS_CHECK_OUTPUT = 3;

/**
 * Genesis contract for validating initial deployment outputs.
 *
 * This contract ensures that during deployment, all non-empty outputs have
 * distinct script hashes, preventing duplicate deployments to the same address.
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
   * 1. Serializes all non-empty output data (scriptHash, satoshis, dataHash)
   * 2. Ensures all non-empty script hashes are unique
   * 3. Verifies the serialized outputs match the transaction context
   *
   * Empty scriptHashes (len == 0) are treated as placeholders and are skipped
   * in both serialization and uniqueness validation.
   *
   * @param outputs - Fixed array of 3 transaction outputs to validate
   * @throws {Error} If any two non-empty outputs have the same scriptHash
   * @throws {Error} If outputs don't match the transaction context
   * @onchain
   */
  @method()
  public checkDeploy(outputs: FixedArray<TxOut, typeof MAX_GENESIS_CHECK_OUTPUT>) {
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

    // Ensure all non-empty script hashes are unique (no duplicate deployments)
    // Empty scriptHashes (len == 0) are placeholders and should be skipped
    if (len(outputs[0].scriptHash) > 0n && len(outputs[1].scriptHash) > 0n) {
      assert(
        outputs[0].scriptHash != outputs[1].scriptHash,
        'Duplicate scriptHash: outputs[0] and outputs[1] have the same scriptHash',
      );
    }
    if (len(outputs[0].scriptHash) > 0n && len(outputs[2].scriptHash) > 0n) {
      assert(
        outputs[0].scriptHash != outputs[2].scriptHash,
        'Duplicate scriptHash: outputs[0] and outputs[2] have the same scriptHash',
      );
    }
    if (len(outputs[1].scriptHash) > 0n && len(outputs[2].scriptHash) > 0n) {
      assert(
        outputs[1].scriptHash != outputs[2].scriptHash,
        'Duplicate scriptHash: outputs[1] and outputs[2] have the same scriptHash',
      );
    }

    // Verify outputs match the transaction context
    assert(this.checkOutputs(outputBytes), 'Outputs mismatch with the transaction context');
  }
}
