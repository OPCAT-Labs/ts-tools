import * as dotenv from 'dotenv';
import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import {
  Genesis,
  MAX_GENESIS_CHECK_OUTPUT,
  MAX_GENESIS_CHECK_INPUT,
} from '../../src/smart-contract/builtin-libs/genesis.js';
import { getDummyUtxo } from '../utils/index.js';
import {
  ExtPsbt,
  bvmVerify,
  toByteString,
  sha256,
  TxOut,
  fill,
} from '@opcat-labs/scrypt-ts-opcat';
import { FixedArray } from '../../src/index.js';
import { uint8ArrayToHex } from '../../src/utils/common.js';
import { Genesis as GenesisLib } from '../../src/smart-contract/builtin-libs/genesis.js';
import { Backtrace } from '../../src/smart-contract/builtin-libs/backtrace.js';

use(chaiAsPromised);
dotenv.config();

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Creates a contract call function for Genesis.checkDeploy that automatically
 * builds the TxOut array from the transaction outputs.
 */
function genesisCheckDeploy(debug = false) {
  return (contract: Genesis, psbt: ExtPsbt) => {
    const emptyOutput: TxOut = {
      scriptHash: toByteString(''),
      satoshis: 0n,
      dataHash: sha256(toByteString('')),
    };
    const outputs: TxOut[] = fill(emptyOutput, MAX_GENESIS_CHECK_OUTPUT);

    const txOutputs = psbt.txOutputs;
    const outputCount = Math.min(txOutputs.length, MAX_GENESIS_CHECK_OUTPUT);

    if (debug) {
      console.log('genesisCheckDeploy: txOutputs.length =', txOutputs.length);
      console.log('genesisCheckDeploy: outputCount =', outputCount);
    }

    for (let i = 0; i < outputCount; i++) {
      const output = txOutputs[i];
      outputs[i] = {
        scriptHash: sha256(toByteString(uint8ArrayToHex(output.script))),
        satoshis: BigInt(output.value),
        dataHash: sha256(toByteString(uint8ArrayToHex(output.data))),
      };
    }

    contract.checkDeploy(
      outputs as FixedArray<TxOut, typeof MAX_GENESIS_CHECK_OUTPUT>,
      BigInt(outputCount)
    );
  };
}

/**
 * Creates a Genesis contract bound to a unique UTXO
 */
function createGenesis(index: number = 0): Genesis {
  const genesis = new Genesis();
  const txId = `${index.toString(16).padStart(2, '0')}a1a777a52f765ebfa295a35c12280279edd46073d41f4767602f819f574f8${index.toString(16).padStart(2, '0')}`;
  genesis.bindToUtxo({
    txId,
    outputIndex: 0,
    satoshis: 10000,
    data: '',
  });
  return genesis;
}

/**
 * Creates a unique script hex string for output index
 * Uses hex values 51-5f (OP_1 to OP_15+) to create unique scripts
 */
function getUniqueScript(index: number): string {
  return (0x51 + index).toString(16);
}

/**
 * Creates a unique UTXO with different txId
 */
function createUniqueUtxo(index: number) {
  const utxo = getDummyUtxo();
  utxo.txId = utxo.txId.slice(0, -2) + index.toString(16).padStart(2, '0');
  return utxo;
}

// ============================================================================
// Test Suite
// ============================================================================

describe('Test Genesis', () => {
  // ============================================================================
  // 1. Genesis Input Index Validation
  // ============================================================================
  describe('Genesis input index validation', () => {
    it('should succeed when Genesis is at input[0]', async () => {
      const genesis = createGenesis(0);
      const psbt = new ExtPsbt()
        .addContractInput(genesis, genesisCheckDeploy())
        .addOutput({
          script: Buffer.from(getUniqueScript(0), 'hex'),
          value: 1000n,
          data: new Uint8Array(),
        })
        .seal()
        .finalizeAllInputs();

      expect(psbt.isFinalized).to.be.true;
      expect(bvmVerify(psbt, 0)).to.eq(true);
    });

    it('should fail when Genesis is not at input index 0', async () => {
      const genesis = createGenesis(0);
      const dummyGenesis = createGenesis(1);

      expect(() => {
        new ExtPsbt()
          .addContractInput(dummyGenesis, genesisCheckDeploy())
          .addContractInput(genesis, genesisCheckDeploy())
          .addOutput({
            script: Buffer.from(getUniqueScript(0), 'hex'),
            value: 1000n,
            data: new Uint8Array(),
          })
          .seal()
          .finalizeAllInputs();
      }).to.throw(/Genesis must be unlocked at input index 0/);
    });
  });

  // ============================================================================
  // 2. Output[0] ScriptHash Uniqueness Validation
  // ============================================================================
  describe('Output[0] scriptHash uniqueness', () => {
    it('should succeed without duplicate scriptHash (outputs[0] != outputs[i]) for all i > 0', async () => {
      const genesis = createGenesis(0);
      const psbt = new ExtPsbt().addContractInput(genesis, genesisCheckDeploy());

      // Add MAX_GENESIS_CHECK_OUTPUT unique outputs
      for (let i = 0; i < MAX_GENESIS_CHECK_OUTPUT; i++) {
        psbt.addOutput({
          script: Buffer.from(getUniqueScript(i), 'hex'),
          value: 1000n,
          data: new Uint8Array(),
        });
      }

      psbt.seal().finalizeAllInputs();
      expect(psbt.isFinalized).to.be.true;
      expect(bvmVerify(psbt, 0)).to.eq(true);
    });

    // Dynamically generate tests for outputs[0] == outputs[i] for all i from 1 to MAX-1
    for (let dupIndex = 1; dupIndex < MAX_GENESIS_CHECK_OUTPUT; dupIndex++) {
      it(`should fail with duplicate scriptHash (outputs[0] == outputs[${dupIndex}])`, async () => {
        const genesis = createGenesis(0);
        const psbt = new ExtPsbt().addContractInput(genesis, genesisCheckDeploy());

        // Add outputs, with outputs[dupIndex] duplicating outputs[0]
        for (let i = 0; i <= dupIndex; i++) {
          const scriptIndex = i === dupIndex ? 0 : i; // Duplicate output[0] at dupIndex
          psbt.addOutput({
            script: Buffer.from(getUniqueScript(scriptIndex), 'hex'),
            value: 1000n,
            data: new Uint8Array(),
          });
        }

        expect(() => {
          psbt.seal().finalizeAllInputs();
        }).to.throw();
      });
    }
  });

  // ============================================================================
  // 3. Non-Output[0] Duplication Allowed
  // ============================================================================
  describe('Non-output[0] duplication allowed', () => {
    // Test all combinations of outputs[i] == outputs[j] for i,j > 0
    for (let i = 1; i < MAX_GENESIS_CHECK_OUTPUT - 1; i++) {
      for (let j = i + 1; j < MAX_GENESIS_CHECK_OUTPUT; j++) {
        it(`should succeed with duplicate scriptHash (outputs[${i}] == outputs[${j}])`, async () => {
          const genesis = createGenesis(0);
          const psbt = new ExtPsbt().addContractInput(genesis, genesisCheckDeploy());

          // Add outputs with outputs[i] == outputs[j]
          for (let k = 0; k <= j; k++) {
            const scriptIndex = k === j ? i : k; // Duplicate outputs[i] at position j
            psbt.addOutput({
              script: Buffer.from(getUniqueScript(scriptIndex), 'hex'),
              value: 1000n,
              data: new Uint8Array(),
            });
          }

          psbt.seal().finalizeAllInputs();
          expect(psbt.isFinalized).to.be.true;
          expect(bvmVerify(psbt, 0)).to.eq(true);
        });
      }
    }
  });

  // ============================================================================
  // 4. Input ScriptHash Validation
  // ============================================================================
  describe('Input scriptHash validation', () => {
    it('should succeed when output[0] scriptHash differs from all input scriptHashes', async () => {
      const genesis = createGenesis(0);
      const psbt = new ExtPsbt()
        .addContractInput(genesis, genesisCheckDeploy())
        .addOutput({
          script: Buffer.from(getUniqueScript(0), 'hex'),
          value: 1000n,
          data: new Uint8Array(),
        })
        .seal()
        .finalizeAllInputs();

      expect(psbt.isFinalized).to.be.true;
      expect(bvmVerify(psbt, 0)).to.eq(true);
    });

    it('should fail when output[0] scriptHash matches input[0] scriptHash', async () => {
      const genesis = createGenesis(0);
      const genesisScript = genesis.lockingScript.toBuffer();

      expect(() => {
        new ExtPsbt()
          .addContractInput(genesis, genesisCheckDeploy())
          .addOutput({
            script: genesisScript,
            value: 1000n,
            data: new Uint8Array(),
          })
          .seal()
          .finalizeAllInputs();
      }).to.throw();
    });
  });

  // ============================================================================
  // 5. Input Count Boundary Validation
  // ============================================================================
  describe('Input count boundary validation', () => {
    it(`should succeed when inputs count == ${MAX_GENESIS_CHECK_INPUT}`, async () => {
      const genesis = createGenesis(0);
      const psbt = new ExtPsbt().addContractInput(genesis, genesisCheckDeploy());

      // Add (MAX_GENESIS_CHECK_INPUT - 1) more P2PKH inputs
      for (let i = 1; i < MAX_GENESIS_CHECK_INPUT; i++) {
        psbt.spendUTXO(createUniqueUtxo(i));
      }

      psbt.addOutput({
        script: Buffer.from(getUniqueScript(0), 'hex'),
        value: 1000n,
        data: new Uint8Array(),
      }).seal();

      expect(psbt.txInputs.length).to.equal(MAX_GENESIS_CHECK_INPUT);
    });

    it(`should fail when inputs count == ${MAX_GENESIS_CHECK_INPUT + 1} (exceeds MAX_GENESIS_CHECK_INPUT)`, async () => {
      // Create MAX_GENESIS_CHECK_INPUT + 1 Genesis contracts
      const genesisContracts: Genesis[] = [];
      for (let i = 0; i <= MAX_GENESIS_CHECK_INPUT; i++) {
        genesisContracts.push(createGenesis(i));
      }

      expect(() => {
        const psbt = new ExtPsbt();
        for (const g of genesisContracts) {
          psbt.addContractInput(g, genesisCheckDeploy());
        }
        psbt
          .addOutput({
            script: Buffer.from(getUniqueScript(0), 'hex'),
            value: 1000n,
            data: new Uint8Array(),
          })
          .seal()
          .finalizeAllInputs();
      }).to.throw(/Too many inputs to validate/);
    });
  });

  // ============================================================================
  // 6. Output Count Boundary Validation
  // ============================================================================
  describe('Output count boundary validation', () => {
    it(`should succeed when outputs count == ${MAX_GENESIS_CHECK_OUTPUT}`, async () => {
      const genesis = createGenesis(0);
      const psbt = new ExtPsbt().addContractInput(genesis, genesisCheckDeploy());

      // Add exactly MAX_GENESIS_CHECK_OUTPUT outputs
      for (let i = 0; i < MAX_GENESIS_CHECK_OUTPUT; i++) {
        psbt.addOutput({
          script: Buffer.from(getUniqueScript(i), 'hex'),
          value: 1000n,
          data: new Uint8Array(),
        });
      }

      psbt.seal();
      expect(psbt.txOutputs.length).to.equal(MAX_GENESIS_CHECK_OUTPUT);
    });

    it(`should fail when outputs count == ${MAX_GENESIS_CHECK_OUTPUT + 1} (exceeds MAX_GENESIS_CHECK_OUTPUT)`, async () => {
      const genesis = createGenesis(0);

      expect(() => {
        const psbt = new ExtPsbt().addContractInput(genesis, genesisCheckDeploy());

        // Add MAX_GENESIS_CHECK_OUTPUT + 1 outputs
        for (let i = 0; i <= MAX_GENESIS_CHECK_OUTPUT; i++) {
          psbt.addOutput({
            script: Buffer.from(getUniqueScript(i), 'hex'),
            value: 1000n,
            data: new Uint8Array(),
          });
        }

        psbt.seal().finalizeAllInputs();
      }).to.throw(/Outputs mismatch with the transaction context/);
    });
  });

  // ============================================================================
  // 7. Output[0] Non-Empty Validation
  // ============================================================================
  describe('Output[0] non-empty validation', () => {
    it('should fail when output[0] is empty (no outputs)', async () => {
      const genesis = createGenesis(0);

      expect(() => {
        new ExtPsbt()
          .addContractInput(genesis, genesisCheckDeploy())
          .seal()
          .finalizeAllInputs();
      }).to.throw();
    });
  });

  // ============================================================================
  // 8. GENESIS_SCRIPT_HASH Validation
  // ============================================================================
  describe('GENESIS_SCRIPT_HASH validation', () => {
    it('should verify GENESIS_SCRIPT_HASH matches library Genesis contract', () => {
      const genesis = new GenesisLib();
      const lockingScript = genesis.lockingScript.toHex();
      const actualScriptHash = sha256(toByteString(lockingScript));

      expect(actualScriptHash).to.equal(
        Backtrace.GENESIS_SCRIPT_HASH,
        `GENESIS_SCRIPT_HASH mismatch! Expected: ${actualScriptHash}, Got: ${Backtrace.GENESIS_SCRIPT_HASH}`
      );
    });

    it('should verify GENESIS_SCRIPT_HASH matches test Genesis contract', () => {
      const genesis = new Genesis();
      const lockingScript = genesis.lockingScript.toHex();
      const actualScriptHash = sha256(toByteString(lockingScript));

      expect(actualScriptHash).to.equal(
        Backtrace.GENESIS_SCRIPT_HASH,
        `Test Genesis scriptHash mismatch! Expected: ${actualScriptHash}, Got: ${Backtrace.GENESIS_SCRIPT_HASH}`
      );
    });
  });

  // ============================================================================
  // 9. Output Count Variations
  // ============================================================================
  describe('Output count variations', () => {
    // Test with different output counts from 1 to MAX
    for (let outputCount = 1; outputCount <= MAX_GENESIS_CHECK_OUTPUT; outputCount++) {
      it(`should succeed with ${outputCount} output(s)`, async () => {
        const genesis = createGenesis(0);
        const psbt = new ExtPsbt().addContractInput(genesis, genesisCheckDeploy());

        for (let i = 0; i < outputCount; i++) {
          psbt.addOutput({
            script: Buffer.from(getUniqueScript(i), 'hex'),
            value: 1000n,
            data: new Uint8Array(),
          });
        }

        psbt.seal().finalizeAllInputs();
        expect(psbt.isFinalized).to.be.true;
        expect(bvmVerify(psbt, 0)).to.eq(true);
      });
    }
  });

  // ============================================================================
  // 10. Additional Edge Cases
  // ============================================================================
  describe('Additional edge cases', () => {
    it('should succeed with outputs containing data', async () => {
      const genesis = createGenesis(0);
      const psbt = new ExtPsbt()
        .addContractInput(genesis, genesisCheckDeploy())
        .addOutput({
          script: Buffer.from(getUniqueScript(0), 'hex'),
          value: 1000n,
          data: Buffer.from('deadbeef', 'hex'),
        })
        .addOutput({
          script: Buffer.from(getUniqueScript(1), 'hex'),
          value: 2000n,
          data: Buffer.from('cafebabe', 'hex'),
        })
        .seal()
        .finalizeAllInputs();

      expect(psbt.isFinalized).to.be.true;
      expect(bvmVerify(psbt, 0)).to.eq(true);
    });

    it('should succeed with varying satoshi amounts', async () => {
      const genesis = createGenesis(0);
      const psbt = new ExtPsbt()
        .addContractInput(genesis, genesisCheckDeploy())
        .addOutput({
          script: Buffer.from(getUniqueScript(0), 'hex'),
          value: 546n, // Dust limit
          data: new Uint8Array(),
        })
        .addOutput({
          script: Buffer.from(getUniqueScript(1), 'hex'),
          value: 5000n, // Moderate amount
          data: new Uint8Array(),
        })
        .seal()
        .finalizeAllInputs();

      expect(psbt.isFinalized).to.be.true;
      expect(bvmVerify(psbt, 0)).to.eq(true);
    });
  });
});
