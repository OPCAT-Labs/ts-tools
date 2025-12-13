import { SmartContract } from '../smartContract.js';
import { method, tags } from '../decorators.js';
import { assert, toByteString, len, sha256, fill } from '../fns/index.js';
import { FixedArray, TxOut } from '../types/index.js';
import { TxUtils } from './txUtils.js';
import { ContextUtils } from './contextUtils.js';
import { ContractCall } from '../../psbt/types.js';
import { uint8ArrayToHex } from '../../utils/common.js';

/**
 * Maximum number of inputs allowed during genesis deployment.
 *
 * ## Purpose
 * Limits the number of inputs validated to prevent script size bloat while
 * maintaining sufficient security coverage.
 *
 * ## Why 6?
 * - **Typical deployments**: 1-3 inputs (Genesis UTXO + fee UTXOs)
 * - **Edge case coverage**: Handles multi-input deployment scenarios
 * - **Script size**: Each input check adds ~50 bytes; 6 is optimal balance
 * - **Security**: Validates all inputs in normal cases
 * - **sCrypt constraint**: Bitcoin Script loops must be unrolled at compile time
 *
 * ## Security Implications
 * Transactions with more than 6 inputs will be **rejected by the contract**.
 * This prevents attackers from hiding duplicate scriptHashes in unchecked input
 * indices beyond the validation limit.
 *
 * @constant
 * @see {@link Genesis.checkDeploy} - Uses this constant for input validation
 * @category Genesis
 */
export const MAX_GENESIS_CHECK_INPUT = 6;

/**
 * Maximum number of outputs to check during genesis deployment.
 *
 * ## Purpose
 * Limits the number of outputs validated during deployment to match input
 * validation coverage and support typical deployment patterns.
 *
 * ## Usage Scenarios
 * - **1 output**: Deploy single contract
 * - **2-3 outputs**: Deploy contract + change outputs
 * - **4-6 outputs**: Multi-contract deployment or complex output structures
 *
 * ## Validation Scope
 * Only `output[0]` must be unique. Other outputs (1-5) can have duplicate
 * scriptHashes as long as they differ from `output[0]`.
 *
 * @constant
 * @see {@link Genesis.checkDeploy} - Uses this constant for output validation
 * @see {@link MAX_GENESIS_CHECK_INPUT} - Corresponding input limit
 * @category Genesis
 */
export const MAX_GENESIS_CHECK_OUTPUT = 6;

/**
 * Genesis contract for validating initial deployment outputs.
 *
 * ## Purpose
 * The Genesis contract ensures that deployed contracts have unique scriptHashes,
 * preventing duplicate deployments and establishing a verifiable deployment origin.
 * It acts as a "genesis UTXO" that validates the first deployment of a contract.
 *
 * ## Deployment Validation Rules
 * 1. **Genesis position**: Genesis must be unlocked at input index 0
 * 2. **Output uniqueness**: Contract at `output[0]` must have unique scriptHash among all outputs
 * 3. **Input differentiation**: Contract at `output[0]` must differ from all input scriptHashes
 * 4. **Input limit**: Transaction must have ≤ {@link MAX_GENESIS_CHECK_INPUT} inputs
 * 5. **Output limit**: Transaction must specify ≤ {@link MAX_GENESIS_CHECK_OUTPUT} outputs
 *
 * ## Why output[0]?
 * Only `output[0]` requires uniqueness validation. This design allows:
 * - Deploying the **primary contract** at output[0] with guaranteed uniqueness
 * - Including **auxiliary contracts** or **change outputs** at indices 1-5
 * - **Multi-output deployments** where only the main contract needs uniqueness
 *
 * ## Empty Placeholders
 * When fewer than {@link MAX_GENESIS_CHECK_OUTPUT} outputs exist, use empty
 * placeholders (scriptHash = empty ByteString) for unused slots. These are
 * ignored during validation.
 *
 * @example
 * **Basic single contract deployment:**
 * ```typescript
 * import { Genesis, genesisCheckDeploy } from '@opcat-labs/scrypt-ts-opcat';
 * import { ExtPsbt } from '@opcat-labs/scrypt-ts-opcat';
 *
 * // 1. Create and bind Genesis contract
 * const genesis = new Genesis();
 * genesis.bindToUtxo(genesisUtxo);
 *
 * // 2. Create the contract to deploy
 * const minter = new CAT20Minter(...);
 *
 * // 3. Build deployment transaction
 * const psbt = new ExtPsbt({ network })
 *   .addContractInput(genesis, genesisCheckDeploy()) // Genesis validates deployment
 *   .addContractOutput(minter, 1000n)                 // Deploy at output[0]
 *   .change(changeAddress, feeRate)
 *   .seal();
 *
 * // 4. Finalize and broadcast
 * await psbt.finalizeAllInputs();
 * const txid = await psbt.broadcast();
 * console.log(`Contract deployed at ${txid}:0`);
 * ```
 *
 * @category Contract
 * @category Genesis
 * @see {@link genesisCheckDeploy} - Helper function for easier deployment
 * @see {@link MAX_GENESIS_CHECK_INPUT} - Maximum inputs validated
 * @see {@link MAX_GENESIS_CHECK_OUTPUT} - Maximum outputs validated
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
   * ## Validation Process
   * This method performs a **two-phase validation**:
   *
   * **Phase 1: Output Serialization & Uniqueness** (lines 168-183)
   * - Iterates through all outputs up to MAX_GENESIS_CHECK_OUTPUT
   * - Serializes valid outputs (index < outputCount) for context matching
   * - Validates `output[0]` scriptHash is unique among all outputs
   * - Ensures no duplicate contracts are deployed in a single transaction
   *
   * **Phase 2: Input Differentiation** (lines 185-195)
   * - Checks `output[0]` differs from all input scriptHashes
   * - Prevents redeployment attacks using existing contract UTXOs
   * - Validates only inputs within MAX_GENESIS_CHECK_INPUT limit
   *
   * ## Why Two Separate Loops?
   * 1. **Output loop**: Dual-purpose (serialize + validate uniqueness)
   * 2. **Input loop**: Independent validation after outputs are processed
   * 3. **sCrypt constraint**: Loops must be unrolled at compile time
   *
   * @param outputs - Fixed array of 6 outputs; fill unused slots with empty placeholders
   * @param outputCount - Number of actual outputs (1-6); outputs beyond this are ignored
   *
   * @throws {Error} 'Genesis must be unlocked at input index 0' - Genesis not at input 0
   * @throws {Error} 'Too many inputs to validate' - More than MAX_GENESIS_CHECK_INPUT inputs
   * @throws {Error} 'Invalid outputCount' - outputCount out of range [1, 6]
   * @throws {Error} 'Output scriptHash must be non-empty' - Empty scriptHash in valid output
   * @throws {Error} 'output[0] must be unique among all outputs' - Duplicate scriptHash in outputs
   * @throws {Error} 'output[0] must differ from all input scriptHashes' - Matches an input
   * @throws {Error} 'Outputs mismatch with the transaction context' - Serialization mismatch
   *
   * @example
   * ```typescript
   * // Advanced: Direct method call (most users should use genesisCheckDeploy helper)
   * const genesis = new Genesis();
   * genesis.bindToUtxo(genesisUtxo);
   *
   * // Create output array with empty placeholders
   * const outputs: TxOut[] = [
   *   { scriptHash: sha256(contractScript), satoshis: 1000n, dataHash: sha256('') },
   *   ...fill({ scriptHash: toByteString(''), satoshis: 0n, dataHash: sha256('') }, 5)
   * ];
   *
   * await genesis.methods.checkDeploy(
   *   outputs as FixedArray<TxOut, 6>,
   *   1n // Only 1 real output, rest are placeholders
   * );
   * ```
   *
   * @see {@link genesisCheckDeploy} - Helper function for easier usage
   * @see {@link MAX_GENESIS_CHECK_INPUT} - Maximum inputs validated
   * @see {@link MAX_GENESIS_CHECK_OUTPUT} - Maximum outputs validated
   * @onchain
   */
  @method()
  public checkDeploy(outputs: FixedArray<TxOut, typeof MAX_GENESIS_CHECK_OUTPUT>, outputCount: bigint) {
    // === PRELIMINARY CHECKS ===

    // Ensure Genesis is unlocked at input index 0
    // This guarantees Genesis validates the deployment and prevents position-based attacks
    assert(this.ctx.inputIndex == 0n, 'Genesis must be unlocked at input index 0');

    // Ensure input count does not exceed the maximum we can check
    // SECURITY: Prevents attackers from hiding duplicate scriptHashes in unchecked input indices
    assert(this.ctx.inputCount <= BigInt(MAX_GENESIS_CHECK_INPUT), 'Too many inputs to validate');

    // Validate outputCount is within valid range [1, MAX_GENESIS_CHECK_OUTPUT]
    assert(
      outputCount > 0n && outputCount <= BigInt(MAX_GENESIS_CHECK_OUTPUT),
      'Invalid outputCount: must be between 1 and MAX_GENESIS_CHECK_OUTPUT'
    );

    // Cache output[0] scriptHash for comparison in validation loops
    // This is more efficient than repeatedly accessing outputs[0].scriptHash
    const output0ScriptHash = outputs[0].scriptHash;

    // === PHASE 1: SERIALIZE OUTPUTS & VALIDATE UNIQUENESS ===

    // Loop through all output slots to:
    // 1. Serialize valid outputs for context matching
    // 2. Validate output[0] uniqueness among all outputs
    // Note: Loop is unrolled at compile time (sCrypt constraint)
    let outputBytes = toByteString('');
    for (let index = 0; index < MAX_GENESIS_CHECK_OUTPUT; index++) {
      const _output = outputs[index];
      if (index < outputCount) {
        // Validate: All valid outputs must have non-empty scriptHash
        assert(len(_output.scriptHash) > 0n, 'Output scriptHash must be non-empty for valid outputs');

        // Serialize this output for later context verification
        outputBytes += TxUtils.buildDataOutput(
          _output.scriptHash,
          _output.satoshis,
          _output.dataHash,
        );

        // Validate: output[0] must be unique among all outputs
        // Skip index 0 (can't compare output[0] with itself)
        if (index > 0) {
          assert(output0ScriptHash != _output.scriptHash, 'output[0] must be unique among all outputs');
        }
      }
      // Else: index >= outputCount, this is an empty placeholder, skip it
    }

    // === PHASE 2: VALIDATE INPUT DIFFERENTIATION ===

    // Ensure output[0] scriptHash differs from all input scriptHashes
    // SECURITY: Prevents redeployment using existing contract UTXOs as inputs
    for (let index = 0; index < MAX_GENESIS_CHECK_INPUT; index++) {
      if (index < this.ctx.inputCount) {
        // Extract scriptHash of input at this index
        const inputScriptHash = ContextUtils.getSpentScriptHash(
          this.ctx.spentScriptHashes,
          BigInt(index)
        );
        // Validate: output[0] must differ from this input
        assert(output0ScriptHash != inputScriptHash, 'output[0] must differ from all input scriptHashes');
      }
      // Else: index >= inputCount, no input at this index, skip it
    }

    // === FINAL CHECK: CONTEXT VERIFICATION ===

    // Verify that our serialized outputs match the transaction's actual outputs
    // This ensures the outputs array passed to this method is truthful
    assert(this.checkOutputs(outputBytes), 'Outputs mismatch with the transaction context');
  }
}

/**
 * Creates a contract call function for Genesis.checkDeploy that automatically
 * builds the TxOut array from transaction outputs.
 *
 * ## What it does
 * This helper function simplifies Genesis deployment by:
 * 1. **Extracting outputs** from the PSBT transaction
 * 2. **Computing hashes** (scriptHash and dataHash) for each output
 * 3. **Creating placeholders** for unused output slots (up to 6 total)
 * 4. **Invoking checkDeploy** with properly formatted parameters
 *
 * ## When to use
 * - **Recommended**: Use this helper when building deployment transactions with ExtPsbt
 * - **Advanced**: Call {@link Genesis.checkDeploy} directly for manual control
 *
 * ## Output Handling
 * - Processes up to {@link MAX_GENESIS_CHECK_OUTPUT} (6) outputs
 * - Automatically limits `outputCount` via `Math.min(txOutputs.length, 6)`
 * - Fills unused slots with empty placeholders (scriptHash = empty ByteString)
 *
 * @returns A ContractCall function compatible with ExtPsbt.addContractInput
 *
 * @example
 * **Basic single contract deployment:**
 * ```typescript
 * import { Genesis, genesisCheckDeploy } from '@opcat-labs/scrypt-ts-opcat';
 * import { ExtPsbt } from '@opcat-labs/scrypt-ts-opcat';
 *
 * // 1. Setup Genesis contract
 * const genesis = new Genesis();
 * genesis.bindToUtxo(genesisUtxo);
 *
 * // 2. Create contract to deploy
 * const minter = new CAT20Minter(...);
 *
 * // 3. Build deployment transaction
 * const psbt = new ExtPsbt({ network })
 *   .addContractInput(genesis, genesisCheckDeploy())  // Genesis validates
 *   .addContractOutput(minter, 1000n)                  // Deploy at output[0]
 *   .change(changeAddress, feeRate)                    // Change output
 *   .seal();
 *
 * // 4. Finalize and broadcast
 * await psbt.finalizeAllInputs();
 * const txid = await psbt.broadcast();
 * console.log(`Contract deployed at ${txid}:0`);
 * ```
 *
 * @example
 * **Multi-output deployment:**
 * ```typescript
 * // Deploy primary contract + auxiliary contracts
 * const psbt = new ExtPsbt({ network })
 *   .addContractInput(genesis, genesisCheckDeploy())
 *   .addContractOutput(primaryContract, 2000n)    // output[0] - must be unique
 *   .addContractOutput(helperContract, 1000n)     // output[1] - can match output[2+]
 *   .addContractOutput(anotherHelper, 1000n)      // output[2] - can match output[1]
 *   .change(changeAddress, feeRate)
 *   .seal();
 * ```
 *
 * @example
 * **Error handling:**
 * ```typescript
 * try {
 *   const psbt = new ExtPsbt({ network })
 *     .addContractInput(genesis, genesisCheckDeploy())
 *     .addContractOutput(contract1, 1000n)  // output[0]
 *     .addContractOutput(contract1, 1000n)  // ❌ Same as output[0] - will fail!
 *     .seal();
 *   await psbt.finalizeAllInputs();
 *   await psbt.broadcast();
 * } catch (error) {
 *   // Error: output[0] must be unique among all outputs
 *   console.error('Deployment failed:', error.message);
 * }
 * ```
 *
 * @category Genesis
 * @see {@link Genesis.checkDeploy} - The underlying contract method
 * @see {@link MAX_GENESIS_CHECK_OUTPUT} - Maximum outputs validated
 */
export function genesisCheckDeploy(): ContractCall<Genesis> {
  return (contract, psbt) => {
    // Create empty placeholder for unused output slots
    // Empty scriptHash signals "no output" to the Genesis contract
    const emptyOutput: TxOut = {
      scriptHash: toByteString(''),      // Empty = placeholder
      satoshis: 0n,                       // Placeholder value
      dataHash: sha256(toByteString('')), // Hash of empty data
    };

    // Initialize array with 6 empty placeholders
    // Genesis contract requires exactly 6 output slots (sCrypt FixedArray constraint)
    const outputs: TxOut[] = fill(emptyOutput, MAX_GENESIS_CHECK_OUTPUT);

    // Extract actual outputs from the transaction being built
    const txOutputs = psbt.txOutputs;

    // Limit to MAX_GENESIS_CHECK_OUTPUT to prevent validation errors
    // If tx has >6 outputs, only first 6 are validated (rare edge case)
    const outputCount = Math.min(txOutputs.length, MAX_GENESIS_CHECK_OUTPUT);

    // Fill the output array with actual transaction outputs
    for (let i = 0; i < outputCount; i++) {
      const output = txOutputs[i];
      outputs[i] = {
        // Compute scriptHash: SHA256 of the output's locking script
        scriptHash: sha256(toByteString(uint8ArrayToHex(output.script))),
        // Output amount in satoshis
        satoshis: BigInt(output.value),
        // Compute dataHash: SHA256 of the output's data field (if any)
        dataHash: sha256(toByteString(uint8ArrayToHex(output.data))),
      };
    }
    // Remaining slots (i >= outputCount) remain as empty placeholders

    contract.checkDeploy(
      outputs as FixedArray<TxOut, typeof MAX_GENESIS_CHECK_OUTPUT>,
      BigInt(outputCount)
    );
  };
}

/**
 * Embedded contract artifact for the Genesis contract.
 *
 * ## What is this?
 * This object contains the compiled sCrypt bytecode and metadata for the Genesis contract.
 * It includes:
 * - **Compiled bytecode** (hex, asm fields) - Executable Bitcoin Script
 * - **Contract ABI** - Method signatures and parameter types
 * - **Struct definitions** (TxOut, SHPreimage) - Type information for complex data structures
 * - **Compiler metadata** - Version, MD5 hash for artifact validation
 *
 * ## Auto-generation
 * This artifact is **automatically generated and updated** by the build script:
 * ```bash
 * npm run gen:contract Genesis
 * ```
 *
 * This command:
 * 1. Compiles the Genesis contract using `npx tspc`
 * 2. Generates artifact JSON in `test/fixtures/genesis.json`
 * 3. Embeds the artifact into this source file (via `updateContractDesc.ts`)
 * 4. Cleans up intermediate compilation files
 *
 * ## Why embedded in source?
 * Embedding the artifact directly in the source file provides:
 * - **Zero-config usage** - No need to load external JSON files
 * - **Type safety** - TypeScript can validate the artifact structure
 * - **Bundler compatibility** - Works seamlessly with webpack, rollup, etc.
 * - **Single-file distribution** - Easier to import and use
 *
 * ## When to update
 * The artifact must be regenerated whenever:
 * - The Genesis contract logic changes
 * - Struct definitions (TxOut, SHPreimage) are modified
 * - The sCrypt compiler version is updated
 *
 * ⚠️ **DO NOT manually edit this object** - Changes will be overwritten on next compilation.
 * To update: modify the contract code above, then run `npm run gen:contract Genesis`.
 *
 * @see {@link updateContractDesc} - Script that embeds this artifact (scripts/updateContractDesc.ts)
 */
const desc = {
  version: 10,
  compilerVersion: "1.21.0+commit.2ada378",
  contract: "Genesis",
  md5: "0b1e184a0aecd042ae661eb8d44a0483",
  structs: [
    {
      name: "TxOut",
      params: [
        {
          name: "scriptHash",
          type: "bytes"
        },
        {
          name: "dataHash",
          type: "bytes"
        },
        {
          name: "satoshis",
          type: "int"
        }
      ],
      genericTypes: []
    },
    {
      name: "SHPreimage",
      params: [
        {
          name: "nVersion",
          type: "bytes"
        },
        {
          name: "hashPrevouts",
          type: "bytes"
        },
        {
          name: "spentScriptHash",
          type: "bytes"
        },
        {
          name: "spentDataHash",
          type: "bytes"
        },
        {
          name: "value",
          type: "int"
        },
        {
          name: "nSequence",
          type: "bytes"
        },
        {
          name: "hashSpentAmounts",
          type: "bytes"
        },
        {
          name: "hashSpentScriptHashes",
          type: "bytes"
        },
        {
          name: "hashSpentDataHashes",
          type: "bytes"
        },
        {
          name: "hashSequences",
          type: "bytes"
        },
        {
          name: "hashOutputs",
          type: "bytes"
        },
        {
          name: "inputIndex",
          type: "int"
        },
        {
          name: "nLockTime",
          type: "int"
        },
        {
          name: "sigHashType",
          type: "int"
        }
      ],
      genericTypes: []
    }
  ],
  library: [
    {
      name: "TxUtils",
      params: [],
      properties: [],
      genericTypes: []
    },
    {
      name: "ContextUtils",
      params: [],
      properties: [],
      genericTypes: []
    },
    {
      name: "StdUtils",
      params: [],
      properties: [],
      genericTypes: []
    }
  ],
  alias: [],
  abi: [
    {
      type: "function",
      name: "checkDeploy",
      index: 0,
      params: [
        {
          name: "outputs",
          type: "TxOut[6]"
        },
        {
          name: "outputCount",
          type: "int"
        },
        {
          name: "__scrypt_ts_shPreimage",
          type: "SHPreimage"
        },
        {
          name: "__scrypt_ts_spentAmounts",
          type: "bytes"
        },
        {
          name: "__scrypt_ts_spentScriptHashes",
          type: "bytes"
        }
      ]
    },
    {
      type: "constructor",
      params: []
    }
  ],
  stateProps: [],
  buildType: "release",
  file: "",
  hex: "512097dfd76851bf465e8f715593b217714858bbe9570ff3bd5e33840a34e20ff0262102ba79df5f8ae7604a9830f03c7933028186aede0675a16f025dc4f8be8eec0382201008ce7480da41702918d1ec8e6849ba32b4d65b1e40dc669c31a1e6306b266c6161011379011379011379011379011379011379011379011379011379011379011379011379011379011379615d798277549c695c79827701209c695b79827701209c695a79827701209c69597900a26958798277549c695779827701209c695679827701209c695579827701209c695479827701209c695379827701209c69527900a269517900a2690079519c640079529c675168640079539c6751686400790281009c6751686400790282009c6751686400790283009c675168695d795d797e5c797e5b797e5a7961007961007900a263007909ffffffffffffffff00a1670068690079586151795179519380007952797f75007f77517a75517a75517a7561517a7561517a75617e59797e58797e57797e56797e55797e54797e5379546151795179519380007952797f75007f77517a75517a75517a75617e5279546151795179519380007952797f75007f77517a75517a75517a75617e517954807e0079517a75517a75517a75517a75517a75517a75517a75517a75517a75517a75517a75517a75517a75517a75517a7561547961517955795579210ac407f0e4bd44bfc207355a778b046225a7068fc59ee7eda43ad905aadbffc800206c266b30e6a1319c66dc401e5bd6b432ba49688eecd118297041da8074ce081057795679615679aa0079610079517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e01007e81517a75615779567956795679567961537956795479577995939521414136d08c5ed2bf3ba048afe6dcaebafeffffffffffffffffffffffffffffff00517951796151795179970079009f63007952799367007968517a75517a75517a7561527a75517a517951795296a0630079527994527a75517a6853798277527982775379012080517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e01205279947f7754537993527993013051797e527e54797e58797e527e53797e52797e57797e0079517a75517a75517a75517a75517a75517a75517a75517a75517a75517a75517a75517a75517a756100795779ac517a75517a75517a75517a75517a75517a75517a75517a75517a7561517a75517a75616955795e79615179aa5179876951795861517982770079527997009c690079527996517a75517a75517a7561517a75517a756155795e795279615279aa5279876900795379012061517982770079527997009c690079527996517a75517a75517a75619c6951517a75517a75517a7561755979009c69007956a16901157900a06301157956a167006869006101286b6c766b796c766b796c766b796c7500011a799f635279827700a0695379537952795479615279827751798277517901209c69007901209c69537900a269537961007961007900a263007909ffffffffffffffff00a1670068690079586151795179519380007952797f75007f77517a75517a75517a7561517a7561517a756155797e53797e517a75517a75517a75517a75517a75617e547a75537a537a537a537975687575756101256b6c766b796c766b796c766b796c7551011a799f635279827700a0695379537952795479615279827751798277517901209c69007901209c69537900a269537961007961007900a263007909ffffffffffffffff00a1670068690079586151795179519380007952797f75007f77517a75517a75517a7561517a7561517a756155797e53797e517a75517a75517a75517a75517a75617e547a75537a537a537a537975687575756101226b6c766b796c766b796c766b796c7552011a799f635279827700a0695379537952795479615279827751798277517901209c69007901209c69537900a269537961007961007900a263007909ffffffffffffffff00a1670068690079586151795179519380007952797f75007f77517a75517a75517a7561517a7561517a756155797e53797e517a75517a75517a75517a75517a75617e547a75537a537a537a5379756875757561011f6b6c766b796c766b796c766b796c7553011a799f635279827700a0695379537952795479615279827751798277517901209c69007901209c69537900a269537961007961007900a263007909ffffffffffffffff00a1670068690079586151795179519380007952797f75007f77517a75517a75517a7561517a7561517a756155797e53797e517a75517a75517a75517a75517a75617e547a75537a537a537a5379756875757561011c6b6c766b796c766b796c766b796c7554011a799f635279827700a0695379537952795479615279827751798277517901209c69007901209c69537900a269537961007961007900a263007909ffffffffffffffff00a1670068690079586151795179519380007952797f75007f77517a75517a75517a7561517a7561517a756155797e53797e517a75517a75517a75517a75517a75617e547a75537a537a537a537975687575756101196b6c766b796c766b796c766b796c7555011a799f635279827700a0695379537952795479615279827751798277517901209c69007901209c69537900a269537961007961007900a263007909ffffffffffffffff00a1670068690079586151795179519380007952797f75007f77517a75517a75517a7561517a7561517a756155797e53797e517a75517a75517a75517a75517a75617e547a75537a537a537a5379756875757501286b6c766b796c766b796c766b796c75527a527a527a7575610053799f63577900615179517951930120957f7551790120957f77517a75517a7561517951798791697568615153799f63577951615179517951930120957f7551790120957f77517a75517a7561517951798791697568615253799f63577952615179517951930120957f7551790120957f77517a75517a7561517951798791697568615353799f63577953615179517951930120957f7551790120957f77517a75517a7561517951798791697568615453799f63577954615179517951930120957f7551790120957f77517a75517a7561517951798791697568615553799f63577955615179517951930120957f7551790120957f77517a75517a756151795179879169756801177951a063007901276b6c766b796c766b796c766b796c75527a527a527a75758791696801177952a063007901246b6c766b796c766b796c766b796c75527a527a527a75758791696801177953a063007901216b6c766b796c766b796c766b796c75527a527a527a75758791696801177954a0630079011e6b6c766b796c766b796c766b796c75527a527a527a75758791696801177955a0630079011b6b6c766b796c766b796c766b796c75527a527a527a7575879169685179aa5d7987777777777777777777777777777777777777777777777777777777777777777777777777777777777777",
  sourceMapFile: ""
};

Genesis.loadArtifact(desc);
