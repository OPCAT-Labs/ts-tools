import { SmartContract } from '../smartContract.js';
import { method, tags, unlock } from '../decorators.js';
import { assert, toByteString, len, sha256, fill, slice } from '../fns/index.js';
import { FixedArray, TxOut } from '../types/index.js';
import { TxUtils } from './txUtils.js';
import { ContractCall, UnlockContext } from '../../psbt/types.js';
import { uint8ArrayToHex } from '../../utils/common.js';
import { TX_OUTPUT_SCRIPT_HASH_LEN } from '../consts.js';

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
 * - Limiting to MAX_GENESIS_CHECK_OUTPUT (3) outputs
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

// Embedded artifact for Genesis contract
const desc = {
  version: 10,
  compilerVersion: '1.21.0+commit.2ada378',
  contract: 'Genesis',
  md5: '0b1e184a0aecd042ae661eb8d44a0483',
  structs: [
    {
      name: 'TxOut',
      params: [
        { name: 'scriptHash', type: 'bytes' },
        { name: 'dataHash', type: 'bytes' },
        { name: 'satoshis', type: 'int' },
      ],
      genericTypes: [],
    },
    {
      name: 'SHPreimage',
      params: [
        { name: 'nVersion', type: 'bytes' },
        { name: 'hashPrevouts', type: 'bytes' },
        { name: 'spentScriptHash', type: 'bytes' },
        { name: 'spentDataHash', type: 'bytes' },
        { name: 'value', type: 'int' },
        { name: 'nSequence', type: 'bytes' },
        { name: 'hashSpentAmounts', type: 'bytes' },
        { name: 'hashSpentScriptHashes', type: 'bytes' },
        { name: 'hashSpentDataHashes', type: 'bytes' },
        { name: 'hashSequences', type: 'bytes' },
        { name: 'hashOutputs', type: 'bytes' },
        { name: 'inputIndex', type: 'int' },
        { name: 'nLockTime', type: 'int' },
        { name: 'sigHashType', type: 'int' },
      ],
      genericTypes: [],
    },
  ],
  library: [
    { name: 'TxUtils', params: [], properties: [], genericTypes: [] },
    { name: 'ContextUtils', params: [], properties: [], genericTypes: [] },
    { name: 'StdUtils', params: [], properties: [], genericTypes: [] },
  ],
  alias: [],
  abi: [
    {
      type: 'function',
      name: 'checkDeploy',
      index: 0,
      params: [
        { name: 'outputs', type: 'TxOut[6]' },
        { name: '__scrypt_ts_shPreimage', type: 'SHPreimage' },
        { name: '__scrypt_ts_spentAmounts', type: 'bytes' },
        { name: '__scrypt_ts_spentScriptHashes', type: 'bytes' },
      ],
    },
    { type: 'constructor', params: [] },
  ],
  stateProps: [],
  buildType: 'release',
  file: '',
  hex: '512097dfd76851bf465e8f715593b217714858bbe9570ff3bd5e33840a34e20ff0262102ba79df5f8ae7604a9830f03c7933028186aede0675a16f025dc4f8be8eec0382201008ce7480da41702918d1ec8e6849ba32b4d65b1e40dc669c31a1e6306b266c6161011379011379011379011379011379011379011379011379011379011379011379011379011379011379615d798277549c695c79827701209c695b79827701209c695a79827701209c69597900a26958798277549c695779827701209c695679827701209c695579827701209c695479827701209c695379827701209c69527900a269517900a2690079519c640079529c675168640079539c6751686400790281009c6751686400790282009c6751686400790283009c675168695d795d797e5c797e5b797e5a7961007961007900a263007909ffffffffffffffff00a1670068690079586151795179519380007952797f75007f77517a75517a75517a7561517a7561517a75617e59797e58797e57797e56797e55797e54797e5379546151795179519380007952797f75007f77517a75517a75517a75617e5279546151795179519380007952797f75007f77517a75517a75517a75617e517954807e0079517a75517a75517a75517a75517a75517a75517a75517a75517a75517a75517a75517a75517a75517a75517a7561547961517955795579210ac407f0e4bd44bfc207355a778b046225a7068fc59ee7eda43ad905aadbffc800206c266b30e6a1319c66dc401e5bd6b432ba49688eecd118297041da8074ce081057795679615679aa0079610079517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e01007e81517a75615779567956795679567961537956795479577995939521414136d08c5ed2bf3ba048afe6dcaebafeffffffffffffffffffffffffffffff00517951796151795179970079009f63007952799367007968517a75517a75517a7561527a75517a517951795296a0630079527994527a75517a6853798277527982775379012080517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e01205279947f7754537993527993013051797e527e54797e58797e527e53797e52797e57797e0079517a75517a75517a75517a75517a75517a75517a75517a75517a75517a75517a75517a75517a756100795779ac517a75517a75517a75517a75517a75517a75517a75517a75517a7561517a75517a75616955795e79615179aa5179876951795861517982770079527997009c690079527996517a75517a75517a7561517a75517a756155795e795279615279aa5279876900795379012061517982770079527997009c690079527996517a75517a75517a75619c6951517a75517a75517a7561755979009c69007956a169006101276b6c766b796c766b796c766b796c755279827700a0635379537952795479615279827751798277517901209c69007901209c69537900a269537961007961007900a263007909ffffffffffffffff00a1670068690079586151795179519380007952797f75007f77517a75517a75517a7561517a7561517a756155797e53797e517a75517a75517a75517a75517a75617e547a75537a537a537a537975687575756101246b6c766b796c766b796c766b796c755279827700a0635379537952795479615279827751798277517901209c69007901209c69537900a269537961007961007900a263007909ffffffffffffffff00a1670068690079586151795179519380007952797f75007f77517a75517a75517a7561517a7561517a756155797e53797e517a75517a75517a75517a75517a75617e547a75537a537a537a537975687575756101216b6c766b796c766b796c766b796c755279827700a0635379537952795479615279827751798277517901209c69007901209c69537900a269537961007961007900a263007909ffffffffffffffff00a1670068690079586151795179519380007952797f75007f77517a75517a75517a7561517a7561517a756155797e53797e517a75517a75517a75517a75517a75617e547a75537a537a537a5379756875757561011e6b6c766b796c766b796c766b796c755279827700a0635379537952795479615279827751798277517901209c69007901209c69537900a269537961007961007900a263007909ffffffffffffffff00a1670068690079586151795179519380007952797f75007f77517a75517a75517a7561517a7561517a756155797e53797e517a75517a75517a75517a75517a75617e547a75537a537a537a5379756875757561011b6b6c766b796c766b796c766b796c755279827700a0635379537952795479615279827751798277517901209c69007901209c69537900a269537961007961007900a263007909ffffffffffffffff00a1670068690079586151795179519380007952797f75007f77517a75517a75517a7561517a7561517a756155797e53797e517a75517a75517a75517a75517a75617e547a75537a537a537a537975687575756101186b6c766b796c766b796c766b796c755279827700a0635379537952795479615279827751798277517901209c69007901209c69537900a269537961007961007900a263007909ffffffffffffffff00a1670068690079586151795179519380007952797f75007f77517a75517a75517a7561517a7561517a756155797e53797e517a75517a75517a75517a75517a75617e547a75537a537a537a5379756875757501276b6c766b796c766b796c766b796c75527a527a527a75750079827700a06900610054799f63587951790120937f7551797f77527951798791695179012093527a75517a5179757568615154799f63587951790120937f7551797f77527951798791695179012093527a75517a5179757568615254799f63587951790120937f7551797f77527951798791695179012093527a75517a5179757568615354799f63587951790120937f7551797f77527951798791695179012093527a75517a5179757568615454799f63587951790120937f7551797f77527951798791695179012093527a75517a5179757568615554799f63587951790120937f7551797f77527951798791695179012093527a75517a517975756801266b6c766b796c766b796c766b796c75527a527a527a7575827700a063517901276b6c766b796c766b796c766b796c75527a527a527a75758791696801236b6c766b796c766b796c766b796c75527a527a527a7575827700a063517901246b6c766b796c766b796c766b796c75527a527a527a75758791696801206b6c766b796c766b796c766b796c75527a527a527a7575827700a063517901216b6c766b796c766b796c766b796c75527a527a527a757587916968011d6b6c766b796c766b796c766b796c75527a527a527a7575827700a0635179011e6b6c766b796c766b796c766b796c75527a527a527a757587916968011a6b6c766b796c766b796c766b796c75527a527a527a7575827700a0635179011b6b6c766b796c766b796c766b796c75527a527a527a7575879169685279aa5e7987777777777777777777777777777777777777777777777777777777777777777777777777777777777777',
  sourceMapFile: '',
};

Genesis.loadArtifact(desc);
