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
  TX_OUTPUT_SCRIPT_HASH_LEN,
  unlock,
  sha256,
  fill,
  ContractCall,
  UnlockContext,
  uint8ArrayToHex
} from '@opcat-labs/scrypt-ts-opcat';

/**
 * Maximum number of inputs to check during genesis deployment.
 *
 * This limit balances security (checking enough inputs to prevent attacks) with
 * script size constraints (each input check adds ~50 bytes to the script).
 *
 * ## Why 6?
 * - Most legitimate deploy transactions have 1-3 inputs (Genesis + fee UTXOs)
 * - 6 inputs provides sufficient coverage for edge cases
 * - Adding more inputs would significantly increase script size and fees
 * - Bitcoin Script loops must be unrolled, so larger limits increase bytecode size
 *
 * ## Security Note
 * If a transaction has more than 6 inputs, only the first 6 are checked.
 * This is acceptable because:
 * 1. Attackers cannot benefit from additional inputs beyond the checked ones
 * 2. The Genesis contract at input[0] is always validated
 */
export const MAX_GENESIS_CHECK_INPUT = 6;

/**
 * Maximum number of outputs to check during genesis deployment.
 *
 * This matches MAX_GENESIS_CHECK_INPUT for consistency and covers
 * typical deployment scenarios (contract output + change outputs).
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
        const inputScriptHash = slice(this.ctx.spentScriptHashes, start, start + TX_OUTPUT_SCRIPT_HASH_LEN);
        assert(output0ScriptHash != inputScriptHash);
        start += TX_OUTPUT_SCRIPT_HASH_LEN;
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

  /**
   * Paired unlock method for `checkDeploy`.
   *
   * This static method is decorated with `@unlock('checkDeploy')` to create a pairing
   * with the `checkDeploy` lock method. When `addContractInput(genesis, 'checkDeploy')`
   * is called, this method will be automatically invoked.
   *
   * The method builds the TxOut array from the PSBT's transaction outputs and
   * calls the contract's `checkDeploy` method.
   *
   * @param ctx - The unlock context containing the contract instance and PSBT
   *
   * @example
   * ```typescript
   * // Using the new pattern with @unlock decorator
   * const deployPsbt = new ExtPsbt({ network })
   *   .addContractInput(genesis, 'checkDeploy')  // Automatically uses unlockCheckDeploy
   *   .addContractOutput(minter, Postage.MINTER_POSTAGE)
   *   .seal();
   *
   * // Or with auto-detection (since Genesis has only one unlock method)
   * const deployPsbt = new ExtPsbt({ network })
   *   .addContractInput(genesis)  // Automatically detects and uses unlockCheckDeploy
   *   .addContractOutput(minter, Postage.MINTER_POSTAGE)
   *   .seal();
   * ```
   */
  @unlock(Genesis, 'checkDeploy')
  static unlockCheckDeploy(ctx: UnlockContext<Genesis>): void {
    const { contract, psbt } = ctx;

    // Create output array with empty placeholders
    const emptyOutput: TxOut = {
      scriptHash: toByteString(''),
      satoshis: 0n,
      dataHash: sha256(toByteString('')),
    };
    const outputs: TxOut[] = fill(emptyOutput, MAX_GENESIS_CHECK_OUTPUT);

    // Fill with actual outputs from the transaction
    const txOutputs = psbt.txOutputs;
    for (let i = 0; i < txOutputs.length && i < MAX_GENESIS_CHECK_OUTPUT; i++) {
      const output = txOutputs[i];
      outputs[i] = {
        scriptHash: sha256(toByteString(uint8ArrayToHex(output.script))),
        satoshis: BigInt(output.value),
        dataHash: sha256(toByteString(uint8ArrayToHex(output.data))),
      };
    }

    contract.checkDeploy(outputs as FixedArray<TxOut, typeof MAX_GENESIS_CHECK_OUTPUT>);
  }
}

/**
 * Creates a contract call function for Genesis.checkDeploy that automatically
 * builds the TxOut array from the transaction outputs.
 *
 * This function handles the conversion of transaction outputs to the TxOut format
 * required by the Genesis contract, including:
 * - Creating empty placeholders for unused output slots
 * - Computing scriptHash and dataHash for each output
 * - Limiting to MAX_GENESIS_CHECK_OUTPUT (6) outputs
 *
 * @returns A ContractCall function that can be used with ExtPsbt.addContractInput
 *
 * @example
 * ```typescript
 * const genesis = new Genesis();
 * genesis.bindToUtxo(genesisUtxo);
 *
 * const deployPsbt = new ExtPsbt({ network })
 *   .addContractInput(genesis, genesisCheckDeploy())
 *   .addContractOutput(minter, Postage.MINTER_POSTAGE)
 *   .change(changeAddress, feeRate)
 *   .seal();
 * ```
 *
 * @category Genesis
 */
export function genesisCheckDeploy(): ContractCall<Genesis> {
  return (contract, psbt) => {
    // Create output array with empty placeholders
    const emptyOutput: TxOut = {
      scriptHash: toByteString(''),
      satoshis: 0n,
      dataHash: sha256(toByteString('')),
    };
    const outputs: TxOut[] = fill(emptyOutput, MAX_GENESIS_CHECK_OUTPUT);

    // Fill with actual outputs from the transaction
    const txOutputs = psbt.txOutputs;
    for (let i = 0; i < txOutputs.length && i < MAX_GENESIS_CHECK_OUTPUT; i++) {
      const output = txOutputs[i];
      outputs[i] = {
        scriptHash: sha256(toByteString(uint8ArrayToHex(output.script))),
        satoshis: BigInt(output.value),
        dataHash: sha256(toByteString(uint8ArrayToHex(output.data))),
      };
    }

    contract.checkDeploy(outputs as FixedArray<TxOut, typeof MAX_GENESIS_CHECK_OUTPUT>);
  };
}
