import * as dotenv from 'dotenv';
import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { Genesis, MAX_GENESIS_CHECK_OUTPUT } from '../../src/smart-contract/builtin-libs/genesis.js';
import { readArtifact, getDummyUtxo } from '../utils/index.js';
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

/**
 * Creates a contract call function for Genesis.checkDeploy that automatically
 * builds the TxOut array from the transaction outputs.
 */
function genesisCheckDeploy(debug = false) {
  return (contract: Genesis, psbt: ExtPsbt) => {
    // Create output array with empty placeholders
    const emptyOutput: TxOut = {
      scriptHash: toByteString(''),
      satoshis: 0n,
      dataHash: sha256(toByteString('')),
    };
    const outputs: TxOut[] = fill(emptyOutput, MAX_GENESIS_CHECK_OUTPUT);

    // Fill with actual outputs from the transaction
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

describe('Test Genesis', () => {
  // ============================================================================
  // 1. Genesis Input Index Validation
  // ============================================================================
  describe('Genesis input index validation', () => {
    it('should succeed when Genesis is at input[0]', async () => {
      const genesis = new Genesis();
      genesis.bindToUtxo({
        txId: 'c1a1a777a52f765ebfa295a35c12280279edd46073d41f4767602f819f574f82',
        outputIndex: 0,
        satoshis: 10000,
        data: '',
      });

      const script1 = toByteString('51');
      const script2 = toByteString('52');

      const psbt = new ExtPsbt()
        .addContractInput(genesis, genesisCheckDeploy())
        .addOutput({
          script: Buffer.from(script1, 'hex'),
          value: 1000n,
          data: new Uint8Array(),
        })
        .addOutput({
          script: Buffer.from(script2, 'hex'),
          value: 1000n,
          data: new Uint8Array(),
        })
        .seal()
        .finalizeAllInputs();

      expect(psbt.isFinalized).to.be.true;
      expect(bvmVerify(psbt, 0)).to.eq(true);
    });

    it('should fail when Genesis is not at input index 0', async () => {
      const genesis = new Genesis();
      genesis.bindToUtxo({
        txId: 'c1a1a777a52f765ebfa295a35c12280279edd46073d41f4767602f819f574f82',
        outputIndex: 0,
        satoshis: 10000,
        data: '',
      });

      // Create another Genesis to use as the first input (wrong position)
      const dummyGenesis = new Genesis();
      dummyGenesis.bindToUtxo({
        txId: 'a1a1a777a52f765ebfa295a35c12280279edd46073d41f4767602f819f574f82',
        outputIndex: 0,
        satoshis: 5000,
        data: '',
      });

      const script1 = toByteString('51');
      const script2 = toByteString('52');

      expect(() => {
        new ExtPsbt()
          // First add dummy Genesis (this will be index 0)
          .addContractInput(dummyGenesis, genesisCheckDeploy())
          // Then add our target Genesis (this will be index 1 - should fail)
          .addContractInput(genesis, genesisCheckDeploy())
          .addOutput({
            script: Buffer.from(script1, 'hex'),
            value: 1000n,
            data: new Uint8Array(),
          })
          .addOutput({
            script: Buffer.from(script2, 'hex'),
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
      const genesis: Genesis = new Genesis();
      genesis.bindToUtxo({
        txId: 'c1a1a777a52f765ebfa295a35c12280279edd46073d41f4767602f819f574f82',
        outputIndex: 0,
        satoshis: 10000,
        data: '',
      });

      const script1 = toByteString('51');
      const script2 = toByteString('52');
      const script3 = toByteString('53');

      const psbt = new ExtPsbt()
        .addContractInput(genesis, genesisCheckDeploy())
        .addOutput({
          script: Buffer.from(script1, 'hex'),
          value: 1000n,
          data: new Uint8Array(),
        })
        .addOutput({
          script: Buffer.from(script2, 'hex'),
          value: 1000n,
          data: new Uint8Array(),
        })
        .addOutput({
          script: Buffer.from(script3, 'hex'),
          value: 1000n,
          data: new Uint8Array(),
        })
        .seal()
        .finalizeAllInputs();

      expect(psbt.isFinalized).to.be.true;
      expect(bvmVerify(psbt, 0)).to.eq(true);
    });

    it('should fail with duplicate scriptHash (outputs[0] == outputs[1])', async () => {
      const genesis = new Genesis();
      genesis.bindToUtxo({
        txId: 'c1a1a777a52f765ebfa295a35c12280279edd46073d41f4767602f819f574f82',
        outputIndex: 0,
        satoshis: 10000,
        data: '',
      });

      const script1 = toByteString('51');
      const script2 = toByteString('51'); // Same as script1 - duplicate!
      const script3 = toByteString('53');

      expect(() => {
        new ExtPsbt()
          .addContractInput(genesis, genesisCheckDeploy())
          .addOutput({
            script: Buffer.from(script1, 'hex'),
            value: 1000n,
            data: new Uint8Array(),
          })
          .addOutput({
            script: Buffer.from(script2, 'hex'),
            value: 1000n,
            data: new Uint8Array(),
          })
          .addOutput({
            script: Buffer.from(script3, 'hex'),
            value: 1000n,
            data: new Uint8Array(),
          })
          .seal()
          .finalizeAllInputs();
      }).to.throw();
    });

    it('should fail with duplicate scriptHash (outputs[0] == outputs[2])', async () => {
      const genesis = new Genesis();
      genesis.bindToUtxo({
        txId: 'c1a1a777a52f765ebfa295a35c12280279edd46073d41f4767602f819f574f82',
        outputIndex: 0,
        satoshis: 10000,
        data: '',
      });

      const script1 = toByteString('51');
      const script2 = toByteString('52');
      const script3 = toByteString('51'); // Same as script1 - duplicate!

      expect(() => {
        new ExtPsbt()
          .addContractInput(genesis, genesisCheckDeploy())
          .addOutput({
            script: Buffer.from(script1, 'hex'),
            value: 1000n,
            data: new Uint8Array(),
          })
          .addOutput({
            script: Buffer.from(script2, 'hex'),
            value: 1000n,
            data: new Uint8Array(),
          })
          .addOutput({
            script: Buffer.from(script3, 'hex'),
            value: 1000n,
            data: new Uint8Array(),
          })
          .seal()
          .finalizeAllInputs();
      }).to.throw();
    });

    it('should fail when output[0] == output[5]', async () => {
      const genesis = new Genesis();
      genesis.bindToUtxo({
        txId: 'c1a1a777a52f765ebfa295a35c12280279edd46073d41f4767602f819f574f82',
        outputIndex: 0,
        satoshis: 10000,
        data: '',
      });

      expect(() => {
        new ExtPsbt()
          .addContractInput(genesis, genesisCheckDeploy())
          .addOutput({
            script: Buffer.from('51', 'hex'),
            value: 1000n,
            data: new Uint8Array(),
          })
          .addOutput({
            script: Buffer.from('52', 'hex'),
            value: 1000n,
            data: new Uint8Array(),
          })
          .addOutput({
            script: Buffer.from('53', 'hex'),
            value: 1000n,
            data: new Uint8Array(),
          })
          .addOutput({
            script: Buffer.from('54', 'hex'),
            value: 1000n,
            data: new Uint8Array(),
          })
          .addOutput({
            script: Buffer.from('55', 'hex'),
            value: 1000n,
            data: new Uint8Array(),
          })
          .addOutput({
            script: Buffer.from('51', 'hex'), // Same as output[0]!
            value: 1000n,
            data: new Uint8Array(),
          })
          .seal()
          .finalizeAllInputs();
      }).to.throw();
    });
  });

  // ============================================================================
  // 3. Non-Output[0] Duplication Allowed
  // ============================================================================
  describe('Non-output[0] duplication allowed', () => {
    it('should succeed with duplicate scriptHash (outputs[i] == outputs[j]) for i,j > 0', async () => {
      const genesis = new Genesis();
      genesis.bindToUtxo({
        txId: 'c1a1a777a52f765ebfa295a35c12280279edd46073d41f4767602f819f574f82',
        outputIndex: 0,
        satoshis: 10000,
        data: '',
      });

      // outputs[1] and outputs[2] use the same script - this is allowed!
      const script1 = toByteString('51');
      const script2 = toByteString('52');
      const script3 = toByteString('52'); // Same as script2 - allowed!

      const psbt = new ExtPsbt()
        .addContractInput(genesis, genesisCheckDeploy())
        .addOutput({
          script: Buffer.from(script1, 'hex'),
          value: 1000n,
          data: new Uint8Array(),
        })
        .addOutput({
          script: Buffer.from(script2, 'hex'),
          value: 1000n,
          data: new Uint8Array(),
        })
        .addOutput({
          script: Buffer.from(script3, 'hex'),
          value: 1000n,
          data: new Uint8Array(),
        })
        .seal()
        .finalizeAllInputs();

      expect(psbt.isFinalized).to.be.true;
      expect(bvmVerify(psbt, 0)).to.eq(true);
    });
  });

  // ============================================================================
  // 4. Input ScriptHash Validation
  // ============================================================================
  describe('Input scriptHash validation', () => {
    it('should succeed when output[0] scriptHash differs from input scriptHash', async () => {
      const genesis = new Genesis();
      genesis.bindToUtxo({
        txId: 'c1a1a777a52f765ebfa295a35c12280279edd46073d41f4767602f819f574f82',
        outputIndex: 0,
        satoshis: 10000,
        data: '',
      });

      // output[0] uses a different script than Genesis input
      const script1 = toByteString('51');
      const script2 = toByteString('52');

      const psbt = new ExtPsbt()
        .addContractInput(genesis, genesisCheckDeploy())
        .addOutput({
          script: Buffer.from(script1, 'hex'),
          value: 1000n,
          data: new Uint8Array(),
        })
        .addOutput({
          script: Buffer.from(script2, 'hex'),
          value: 1000n,
          data: new Uint8Array(),
        })
        .seal()
        .finalizeAllInputs();

      expect(psbt.isFinalized).to.be.true;
      expect(bvmVerify(psbt, 0)).to.eq(true);
    });

    it('should fail when output[0] scriptHash matches input[0] scriptHash', async () => {
      const genesis = new Genesis();
      genesis.bindToUtxo({
        txId: 'c1a1a777a52f765ebfa295a35c12280279edd46073d41f4767602f819f574f82',
        outputIndex: 0,
        satoshis: 10000,
        data: '',
      });

      // Get the Genesis contract's locking script
      const genesisScript = genesis.lockingScript.toBuffer();

      expect(() => {
        new ExtPsbt()
          .addContractInput(genesis, genesisCheckDeploy())
          // output[0] uses the SAME script as Genesis input - should fail!
          .addOutput({
            script: genesisScript,
            value: 1000n,
            data: new Uint8Array(),
          })
          .addOutput({
            script: Buffer.from('52', 'hex'),
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
    it('should succeed when inputs count <= 6', async () => {
      // Create 1 Genesis contract at index 0
      const genesis = new Genesis();
      genesis.bindToUtxo({
        txId: '02a1a777a52f765ebfa295a35c12280279edd46073d41f4767602f819f574f80',
        outputIndex: 0,
        satoshis: 1000,
        data: '',
      });

      const script1 = toByteString('51');

      // Helper to create unique UTXOs with different txIds
      const createUniqueUtxo = (index: number) => {
        const utxo = getDummyUtxo();
        // Modify txId to make it unique by changing last character
        utxo.txId = utxo.txId.slice(0, -1) + index.toString(16);
        return utxo;
      };

      // Transaction with 6 inputs (1 Genesis + 5 P2PKH) should succeed
      const psbt = new ExtPsbt()
        .addContractInput(genesis, genesisCheckDeploy())
        // Add 5 more P2PKH inputs with unique txIds to make total 6
        .spendUTXO(createUniqueUtxo(1))
        .spendUTXO(createUniqueUtxo(2))
        .spendUTXO(createUniqueUtxo(3))
        .spendUTXO(createUniqueUtxo(4))
        .spendUTXO(createUniqueUtxo(5))
        .addOutput({
          script: Buffer.from(script1, 'hex'),
          value: 1000n,
          data: new Uint8Array(),
        })
        .seal();

      // Verify the Genesis contract input was finalized successfully
      expect(psbt.txInputs.length).to.equal(6);
    });

    it('should fail when inputs count > 6', async () => {
      // Create 7 Genesis contracts to use as inputs
      const genesisContracts: Genesis[] = [];
      for (let i = 0; i < 7; i++) {
        const g = new Genesis();
        // Each txId must be exactly 64 hex chars
        const txId = `${i}1a1a777a52f765ebfa295a35c12280279edd46073d41f4767602f819f574f8${i}`;
        g.bindToUtxo({
          txId,
          outputIndex: 0,
          satoshis: 1000,
          data: '',
        });
        genesisContracts.push(g);
      }

      const script1 = toByteString('51');

      // Try to create a transaction with 7 Genesis inputs
      // This should fail because inputCount (7) > MAX_GENESIS_CHECK_INPUT (6)
      expect(() => {
        const psbt = new ExtPsbt();
        // Add all 7 Genesis contracts as inputs
        for (const g of genesisContracts) {
          psbt.addContractInput(g, genesisCheckDeploy());
        }
        psbt
          .addOutput({
            script: Buffer.from(script1, 'hex'),
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
    it('should succeed when outputs count <= 6', async () => {
      const genesis = new Genesis();
      genesis.bindToUtxo({
        txId: 'e1a1a777a52f765ebfa295a35c12280279edd46073d41f4767602f819f574f82',
        outputIndex: 0,
        satoshis: 10000,
        data: '',
      });

      // Transaction with exactly 6 outputs should succeed
      const psbt = new ExtPsbt()
        .addContractInput(genesis, genesisCheckDeploy())
        // Add 6 unique outputs
        .addOutput({ script: Buffer.from('51', 'hex'), value: 1000n, data: new Uint8Array() })
        .addOutput({ script: Buffer.from('52', 'hex'), value: 1000n, data: new Uint8Array() })
        .addOutput({ script: Buffer.from('53', 'hex'), value: 1000n, data: new Uint8Array() })
        .addOutput({ script: Buffer.from('54', 'hex'), value: 1000n, data: new Uint8Array() })
        .addOutput({ script: Buffer.from('55', 'hex'), value: 1000n, data: new Uint8Array() })
        .addOutput({ script: Buffer.from('56', 'hex'), value: 1000n, data: new Uint8Array() })
        .seal();

      expect(psbt.txOutputs.length).to.equal(6);
    });

    it('should fail when outputs count > 6', async () => {
      const genesis = new Genesis();
      genesis.bindToUtxo({
        txId: 'd1a1a777a52f765ebfa295a35c12280279edd46073d41f4767602f819f574f82',
        outputIndex: 0,
        satoshis: 10000,
        data: '',
      });

      // Transaction with 7 outputs should fail
      expect(() => {
        new ExtPsbt()
          .addContractInput(genesis, genesisCheckDeploy())
          // Add 7 unique outputs
          .addOutput({ script: Buffer.from('51', 'hex'), value: 1000n, data: new Uint8Array() })
          .addOutput({ script: Buffer.from('52', 'hex'), value: 1000n, data: new Uint8Array() })
          .addOutput({ script: Buffer.from('53', 'hex'), value: 1000n, data: new Uint8Array() })
          .addOutput({ script: Buffer.from('54', 'hex'), value: 1000n, data: new Uint8Array() })
          .addOutput({ script: Buffer.from('55', 'hex'), value: 1000n, data: new Uint8Array() })
          .addOutput({ script: Buffer.from('56', 'hex'), value: 1000n, data: new Uint8Array() })
          .addOutput({ script: Buffer.from('57', 'hex'), value: 1000n, data: new Uint8Array() }) // 7th output
          .seal()
          .finalizeAllInputs();
      }).to.throw(/Outputs mismatch with the transaction context/);
    });
  });

  // ============================================================================
  // 7. Output[0] Non-Empty Validation
  // ============================================================================
  describe('Output[0] non-empty validation', () => {
    it('should fail when output[0] is empty (no outputs)', async () => {
      const genesis = new Genesis();
      genesis.bindToUtxo({
        txId: 'c1a1a777a52f765ebfa295a35c12280279edd46073d41f4767602f819f574f82',
        outputIndex: 0,
        satoshis: 10000,
        data: '',
      });

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
      // Get the Genesis contract from the library (with embedded artifact)
      const genesis = new GenesisLib();

      // Calculate the actual scriptHash of the Genesis contract
      const lockingScript = genesis.lockingScript.toHex();
      const actualScriptHash = sha256(toByteString(lockingScript));

      // Verify it matches the hardcoded GENESIS_SCRIPT_HASH in Backtrace
      expect(actualScriptHash).to.equal(
        Backtrace.GENESIS_SCRIPT_HASH,
        `GENESIS_SCRIPT_HASH mismatch! Expected: ${actualScriptHash}, Got: ${Backtrace.GENESIS_SCRIPT_HASH}. ` +
        `If the Genesis contract was updated, please update GENESIS_SCRIPT_HASH in backtrace.ts`
      );
    });

    it('should verify GENESIS_SCRIPT_HASH matches test Genesis contract', () => {
      const genesis = new Genesis();

      const lockingScript = genesis.lockingScript.toHex();
      const actualScriptHash = sha256(toByteString(lockingScript));

      expect(actualScriptHash).to.equal(
        Backtrace.GENESIS_SCRIPT_HASH,
        `Test Genesis contract scriptHash mismatch! Expected: ${actualScriptHash}, Got: ${Backtrace.GENESIS_SCRIPT_HASH}`
      );
    });
  });

  // ============================================================================
  // 9. Additional Edge Cases
  // ============================================================================
  describe('Additional edge cases', () => {
    it('should succeed with 1 real output and empty placeholders', async () => {
      const genesis = new Genesis();
      genesis.bindToUtxo({
        txId: 'c1a1a777a52f765ebfa295a35c12280279edd46073d41f4767602f819f574f82',
        outputIndex: 0,
        satoshis: 10000,
        data: '',
      });

      const script1 = toByteString('51');

      const psbt = new ExtPsbt()
        .addContractInput(genesis, genesisCheckDeploy())
        .addOutput({
          script: Buffer.from(script1, 'hex'),
          value: 1000n,
          data: new Uint8Array(),
        })
        .seal()
        .finalizeAllInputs();

      expect(psbt.isFinalized).to.be.true;
      expect(bvmVerify(psbt, 0)).to.eq(true);
    });

    it('should succeed with outputs containing data', async () => {
      const genesis = new Genesis();
      genesis.bindToUtxo({
        txId: 'c1a1a777a52f765ebfa295a35c12280279edd46073d41f4767602f819f574f82',
        outputIndex: 0,
        satoshis: 10000,
        data: '',
      });

      const script1 = toByteString('51');
      const script2 = toByteString('52');
      const data1 = toByteString('deadbeef');
      const data2 = toByteString('cafebabe');

      const psbt = new ExtPsbt()
        .addContractInput(genesis, genesisCheckDeploy())
        .addOutput({
          script: Buffer.from(script1, 'hex'),
          value: 1000n,
          data: Buffer.from(data1, 'hex'),
        })
        .addOutput({
          script: Buffer.from(script2, 'hex'),
          value: 2000n,
          data: Buffer.from(data2, 'hex'),
        })
        .seal()
        .finalizeAllInputs();

      expect(psbt.isFinalized).to.be.true;
      expect(bvmVerify(psbt, 0)).to.eq(true);
    });

    it('should succeed with varying satoshi amounts', async () => {
      const genesis = new Genesis();
      genesis.bindToUtxo({
        txId: 'c1a1a777a52f765ebfa295a35c12280279edd46073d41f4767602f819f574f82',
        outputIndex: 0,
        satoshis: 10000,
        data: '',
      });

      const script1 = toByteString('51');
      const script2 = toByteString('52');
      const script3 = toByteString('53');

      const psbt = new ExtPsbt()
        .addContractInput(genesis, genesisCheckDeploy())
        .addOutput({
          script: Buffer.from(script1, 'hex'),
          value: 546n, // Dust limit
          data: new Uint8Array(),
        })
        .addOutput({
          script: Buffer.from(script2, 'hex'),
          value: 5000n, // Moderate amount
          data: new Uint8Array(),
        })
        .addOutput({
          script: Buffer.from(script3, 'hex'),
          value: 1000n, // Small amount
          data: new Uint8Array(),
        })
        .seal()
        .finalizeAllInputs();

      expect(psbt.isFinalized).to.be.true;
      expect(bvmVerify(psbt, 0)).to.eq(true);
    });
  });
});
