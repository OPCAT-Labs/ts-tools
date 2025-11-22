import { SmartContract } from '../smartContract.js';
import { method, tags } from '../decorators.js';
import { assert, toByteString, len } from '../fns/index.js';
import { FixedArray, TxOut } from '../types/index.js';
import { TxUtils } from './txUtils.js';

/**
 * Maximum number of outputs to check during genesis deployment
 */
export const MAX_GENESIS_CHECK_OUTPUT = 3;

/**
 * Genesis contract for validating initial deployment outputs.
 *
 * This contract ensures that during deployment, exactly 3 outputs are created
 * with distinct script hashes, preventing duplicate deployments to the same address.
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
   * 1. Serializes all output data (scriptHash, satoshis, dataHash)
   * 2. Ensures all three output script hashes are unique
   * 3. Verifies the serialized outputs match the transaction context
   *
   * @param outputs - Fixed array of 3 transaction outputs to validate
   * @throws {Error} If any two outputs have the same scriptHash
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

    // Ensure all script hashes are unique (no duplicate deployments)
    assert(
      outputs[0].scriptHash != outputs[1].scriptHash,
      'Duplicate scriptHash: outputs[0] and outputs[1] have the same scriptHash',
    );
    assert(
      outputs[0].scriptHash != outputs[2].scriptHash,
      'Duplicate scriptHash: outputs[0] and outputs[2] have the same scriptHash',
    );
    assert(
      outputs[1].scriptHash != outputs[2].scriptHash,
      'Duplicate scriptHash: outputs[1] and outputs[2] have the same scriptHash',
    );

    // Verify outputs match the transaction context
    assert(this.checkOutputs(outputBytes), 'Outputs mismatch with the transaction context');
  }
}
