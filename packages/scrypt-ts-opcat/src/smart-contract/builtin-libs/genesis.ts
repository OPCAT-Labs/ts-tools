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

// Embedded artifact for Genesis contract
const desc = {
  version: 10,
  compilerVersion: '1.21.0+commit.2ada378',
  contract: 'Genesis',
  md5: 'd3404c4b368255eec0f93e2d868e4510',
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
        { name: 'outputs', type: 'TxOut[3]' },
        { name: '__scrypt_ts_shPreimage', type: 'SHPreimage' },
      ],
    },
    { type: 'constructor', params: [] },
  ],
  stateProps: [],
  buildType: 'release',
  file: '',
  hex: '512097dfd76851bf465e8f715593b217714858bbe9570ff3bd5e33840a34e20ff0262102ba79df5f8ae7604a9830f03c7933028186aede0675a16f025dc4f8be8eec0382201008ce7480da41702918d1ec8e6849ba32b4d65b1e40dc669c31a1e6306b266c0111790111790111790111790111790111790111790111790111790111790111790111790111790111795d798277549d5c79827701209d5b79827701209d5a79827701209d597900a26958798277549d5779827701209d5679827701209d5579827701209d5479827701209d5379827701209d527900a2697800a26976519c6476529c6751686476539c67516864760281009c67516864760282009c67516864760283009c675168695d795d797e5c797e5b797e5a79767600a2637609ffffffffffffffff00a16700686976586e8b806e7c7f75007f6b6d6d6d6c7e59797e58797e57797e56797e55797e54797e5379546e8b806e7c7f75007f6b6d6d6c7e5279546e8b806e7c7f75007f6b6d6d6c7e7854807e6b6d6d6d6d6d6d6d6c54797855795579210ac407f0e4bd44bfc207355a778b046225a7068fc59ee7eda43ad905aadbffc800206c266b30e6a1319c66dc401e5bd6b432ba49688eecd118297041da8074ce0810577956795679aa7676517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e01007e817757795679567956795679537956795479577995939521414136d08c5ed2bf3ba048afe6dcaebafeffffffffffffffffffffffffffffff006e6e9776009f636e936776687777777b757c6e5296a0636e7c947b757c6853798277527982775379012080517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e01205279947f77545379935279930130787e527e54797e58797e527e53797e52797e57797e6b6d6d6d6d6d6d6c765779ac6b6d6d6d6d6d6c776900011b766b796c766b796c766b796c755279827700a06370707c527982777882777801209d7601209d537900a2695379767600a2637609ffffffffffffffff00a16700686976586e8b806e7c7f75007f6b6d6d6d6c55797e53797e6b6d6d6c777e547a7572537a537975686d750118766b796c766b796c766b796c755279827700a06370707c527982777882777801209d7601209d537900a2695379767600a2637609ffffffffffffffff00a16700686976586e8b806e7c7f75007f6b6d6d6d6c55797e53797e6b6d6d6c777e547a7572537a537975686d750115766b796c766b796c766b796c755279827700a06370707c527982777882777801209d7601209d537900a2695379767600a2637609ffffffffffffffff00a16700686976586e8b806e7c7f75007f6b6d6d6d6c55797e53797e6b6d6d6c777e547a7572537a537975686d75011b766b796c766b796c766b796c6d7c77827700a0630118766b796c766b796c766b796c6d7c77827700a067006863011b766b796c766b796c766b796c6d7c770119766b796c766b796c766b796c6d7c7787916968011b766b796c766b796c766b796c6d7c77827700a0630115766b796c766b796c766b796c6d7c77827700a067006863011b766b796c766b796c766b796c6d7c770116766b796c766b796c766b796c6d7c77879169680118766b796c766b796c766b796c6d7c77827700a0630115766b796c766b796c766b796c6d7c77827700a0670068630118766b796c766b796c766b796c6d7c770116766b796c766b796c766b796c6d7c778791696876aa5979876b6d6d6d6d6d6d6d6d6d6d6d6d6d6d6c',
  sourceMapFile: '',
};

Genesis.loadArtifact(desc);
