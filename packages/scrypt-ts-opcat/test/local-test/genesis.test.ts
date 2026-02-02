import * as dotenv from 'dotenv';
import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import {
  Genesis,
  MAX_GENESIS_CHECK_OUTPUT,
  MAX_GENESIS_CHECK_INPUT,
} from '../../src/smart-contract/builtin-libs/genesis.js';
import { getDummyUtxo, getDefaultSigner } from '../utils/index.js';
import {
  ExtPsbt,
  bvmVerify,
  toByteString,
  sha256,
  TxOut,
  fill,
  Signer,
} from '@opcat-labs/scrypt-ts-opcat';
import { FixedArray } from '../../src/index.js';
import { uint8ArrayToHex } from '../../src/utils/common.js';
import { Backtrace } from '../../src/smart-contract/builtin-libs/backtrace.js';
import { crypto, PrivateKey, Networks } from '@opcat-labs/opcat';
import { encodeSHPreimage } from '../../src/utils/preimage.js';
import { hash256 } from '../../src/smart-contract/fns/hashes.js';

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

// ============================================================================
// Test Suite
// ============================================================================

describe('Test Genesis', () => {
  describe('Core validation tests', () => {
    // 1. Genesis input index validation
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

    // 2. Output[0] uniqueness - success case
    it('should succeed without duplicate scriptHash (outputs[0] != outputs[i]) for all i > 0', async () => {
      const genesis = createGenesis(0);
      const psbt = new ExtPsbt().addContractInput(genesis, genesisCheckDeploy());

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

    // 3. Output[0] uniqueness - dynamic failure tests for all i > 0
    for (let dupIndex = 1; dupIndex < MAX_GENESIS_CHECK_OUTPUT; dupIndex++) {
      it(`should fail with duplicate scriptHash (outputs[0] == outputs[${dupIndex}])`, async () => {
        const genesis = createGenesis(0);
        const psbt = new ExtPsbt().addContractInput(genesis, genesisCheckDeploy());
        for (let i = 0; i <= dupIndex; i++) {
          const scriptIndex = i === dupIndex ? 0 : i;
          psbt.addOutput({ script: Buffer.from(getUniqueScript(scriptIndex), 'hex'), value: 1000n, data: new Uint8Array() });
        }
        expect(() => psbt.seal().finalizeAllInputs()).to.throw();
      });
    }

    // 4. Non-output[0] duplication allowed - dynamic tests for all i,j > 0 where i < j
    for (let i = 1; i < MAX_GENESIS_CHECK_OUTPUT - 1; i++) {
      for (let j = i + 1; j < MAX_GENESIS_CHECK_OUTPUT; j++) {
        it(`should succeed with duplicate scriptHash (outputs[${i}] == outputs[${j}])`, async () => {
          const genesis = createGenesis(0);
          const psbt = new ExtPsbt().addContractInput(genesis, genesisCheckDeploy());
          for (let k = 0; k <= j; k++) {
            const scriptIndex = k === j ? i : k;
            psbt.addOutput({ script: Buffer.from(getUniqueScript(scriptIndex), 'hex'), value: 1000n, data: new Uint8Array() });
          }
          psbt.seal().finalizeAllInputs();
          expect(psbt.isFinalized).to.be.true;
          expect(bvmVerify(psbt, 0)).to.eq(true);
        });
      }
    }

    // 5. Output count boundary - dynamic tests for all counts 1 to MAX
    for (let outputCount = 1; outputCount <= MAX_GENESIS_CHECK_OUTPUT; outputCount++) {
      it(`should succeed when outputs count == ${outputCount}`, async () => {
        const genesis = createGenesis(0);
        const psbt = new ExtPsbt().addContractInput(genesis, genesisCheckDeploy());
        for (let i = 0; i < outputCount; i++) {
          psbt.addOutput({ script: Buffer.from(getUniqueScript(i), 'hex'), value: 1000n, data: new Uint8Array() });
        }
        psbt.seal().finalizeAllInputs();
        expect(psbt.isFinalized).to.be.true;
        expect(bvmVerify(psbt, 0)).to.eq(true);
      });
    }

    // 6. Output count boundary - failure when exceeds MAX
    it(`should fail when outputs count == ${MAX_GENESIS_CHECK_OUTPUT + 1}`, async () => {
      const genesis = createGenesis(0);
      expect(() => {
        const psbt = new ExtPsbt().addContractInput(genesis, genesisCheckDeploy());
        for (let i = 0; i <= MAX_GENESIS_CHECK_OUTPUT; i++) {
          psbt.addOutput({ script: Buffer.from(getUniqueScript(i), 'hex'), value: 1000n, data: new Uint8Array() });
        }
        psbt.seal().finalizeAllInputs();
      }).to.throw();
    });

    // 7. Input count boundary - dynamic tests for all counts 1 to MAX
    for (let inputCount = 1; inputCount <= MAX_GENESIS_CHECK_INPUT; inputCount++) {
      it(`should succeed when inputs count == ${inputCount}`, async () => {
        const signer: Signer = getDefaultSigner();
        const address = await signer.getAddress();
        const genesis = createGenesis(0);
        const psbt = new ExtPsbt().addContractInput(genesis, genesisCheckDeploy());

        // Create unique signable UTXOs using signer's address
        for (let i = 1; i < inputCount; i++) {
          const utxo = getDummyUtxo(address, 10000);
          utxo.txId = utxo.txId.slice(0, -2) + i.toString(16).padStart(2, '0');
          utxo.outputIndex = i;
          psbt.spendUTXO(utxo);
        }

        psbt.addOutput({ script: Buffer.from(getUniqueScript(0), 'hex'), value: 1000n, data: new Uint8Array() }).seal();
        expect(psbt.txInputs.length).to.equal(inputCount);

        // Sign P2PKH inputs (skip contract input at index 0)
        if (inputCount > 1) {
          const signedHex = await signer.signPsbt(psbt.toHex(), psbt.psbtOptions());
          psbt.combine(ExtPsbt.fromHex(signedHex));
        }

        psbt.finalizeAllInputs();
        expect(psbt.isFinalized).to.be.true;
        expect(bvmVerify(psbt, 0)).to.eq(true);
      });
    }

    // 8. Input count boundary - failure when exceeds MAX
    it(`should fail when inputs count == ${MAX_GENESIS_CHECK_INPUT + 1}`, async () => {
      const genesisContracts: Genesis[] = [];
      for (let i = 0; i <= MAX_GENESIS_CHECK_INPUT; i++) {
        genesisContracts.push(createGenesis(i));
      }
      expect(() => {
        const psbt = new ExtPsbt();
        for (const g of genesisContracts) {
          psbt.addContractInput(g, genesisCheckDeploy());
        }
        psbt.addOutput({ script: Buffer.from(getUniqueScript(0), 'hex'), value: 1000n, data: new Uint8Array() }).seal().finalizeAllInputs();
      }).to.throw(/Too many inputs to validate/);
    });
  });

  describe('Input scriptHash validation', () => {
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

  describe('GENESIS_SCRIPT_HASH validation', () => {
    it('should verify GENESIS_SCRIPT_HASH matches Genesis contract', () => {
      const genesis = new Genesis();
      const lockingScript = genesis.lockingScript.toHex();
      const actualScriptHash = sha256(toByteString(lockingScript));

      expect(actualScriptHash).to.equal(
        Backtrace.GENESIS_SCRIPT_HASH,
        `GENESIS_SCRIPT_HASH mismatch! Expected: ${actualScriptHash}, Got: ${Backtrace.GENESIS_SCRIPT_HASH}`
      );
    });
  });

  describe('checkPreimage validation', () => {
    // Test case 1: Invalid preimage (modified hashOutputs in unlocking script)
    // First build the transaction correctly, then replace the hashOutputs in unlocking script
    it('should fail when injected preimage has wrong hashOutputs', async () => {
      const genesis = createGenesis(0);

      // Build the transaction correctly first
      const psbt = new ExtPsbt()
        .addContractInput(genesis, genesisCheckDeploy())
        .addOutput({
          script: Buffer.from(getUniqueScript(0), 'hex'),
          value: 1000n,
          data: new Uint8Array(),
        })
        .seal()
        .finalizeAllInputs();

      // Get the correct hashOutputs from context
      const inputCtx = (psbt as any)._ctxProvider.getInputCtx(0);
      const correctHashOutputs = inputCtx.shPreimage.hashOutputs;

      // Create a wrong hashOutputs
      const wrongHashOutputs = sha256(toByteString('invalid_outputs', true));

      // Get the finalized unlocking script from psbt.data.inputs
      const finalScriptSig = psbt.data.inputs[0].finalScriptSig!;
      const unlockingScriptHex = Buffer.from(finalScriptSig).toString('hex');

      // Replace the correct hashOutputs with wrong one in unlocking script
      const modifiedUnlockingScriptHex = unlockingScriptHex.replace(correctHashOutputs, wrongHashOutputs);

      // Update the psbt's finalScriptSig directly
      psbt.data.inputs[0].finalScriptSig = Buffer.from(modifiedUnlockingScriptHex, 'hex');

      // Now verify with BVM - should fail because hashOutputs doesn't match
      // Expected error: SCRIPT_ERR_NULLFAIL (signature verification failed)
      const result = bvmVerify(psbt, 0);
      expect(result).to.eq('SCRIPT_ERR_NULLFAIL');
    });

    // Test case 2: Invalid signature (using wrong private key)
    // First build the transaction correctly, then replace the signature with wrong one
    it('should fail when injected preimage signature is wrong', async () => {
      const genesis = createGenesis(0);

      // Build the transaction correctly first
      const psbt = new ExtPsbt()
        .addContractInput(genesis, genesisCheckDeploy())
        .addOutput({
          script: Buffer.from(getUniqueScript(0), 'hex'),
          value: 1000n,
          data: new Uint8Array(),
        })
        .seal()
        .finalizeAllInputs();

      // Get the correct signature from the contract (with sighash flag)
      const correctSigWithFlag = (genesis as any)._injectedPreimageSig as string;
      // The pure DER signature (without sighash flag) used in checkDataSig
      const correctPureDerSig = correctSigWithFlag.slice(0, -2); // Remove last byte (sighash flag '01')

      // Wrong private key (different from the hardcoded one in sigUtils.ts)
      const WRONG_PRIVATE_KEY_HEX = '1111111111111111111111111111111111111111111111111111111111111111';

      // Generate wrong signature using wrong private key
      const inputCtx = (psbt as any)._ctxProvider.getInputCtx(0);
      const preimage = encodeSHPreimage(inputCtx.shPreimage);
      const hashBuf = Buffer.from(hash256(preimage), 'hex').reverse();
      const wrongPrivateKey = PrivateKey.fromHex(WRONG_PRIVATE_KEY_HEX, Networks.defaultNetwork);
      const wrongSignature = crypto.ECDSA.sign(hashBuf, wrongPrivateKey, 'little');
      const wrongPureDerSig = wrongSignature.toDER().toString('hex'); // Pure DER without sighash flag

      // Get the finalized unlocking script from psbt.data.inputs
      const finalScriptSig = psbt.data.inputs[0].finalScriptSig!;
      const unlockingScriptHex = Buffer.from(finalScriptSig).toString('hex');

      // Replace the correct pure DER signature with wrong one in unlocking script
      // Note: checkDataSig uses pure DER sig (without sighash flag)
      const modifiedUnlockingScriptHex = unlockingScriptHex.replace(correctPureDerSig, wrongPureDerSig);

      // Update the psbt's finalScriptSig directly
      psbt.data.inputs[0].finalScriptSig = Buffer.from(modifiedUnlockingScriptHex, 'hex');

      // Now verify with BVM - should fail because signature doesn't match ContextUtils.pubKey
      // Expected error: SCRIPT_ERR_NULLFAIL (signature verification failed)
      const result = bvmVerify(psbt, 0);
      expect(result).to.eq('SCRIPT_ERR_NULLFAIL');
    });
  });
});
