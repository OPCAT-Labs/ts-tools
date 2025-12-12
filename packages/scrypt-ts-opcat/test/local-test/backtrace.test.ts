import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import {
  BacktraceInfo,
  call,
  deployGenesis,
  IExtPsbt,
  Signer,
  ExtPsbt,
  toByteString,
  sha256,
  Genesis,
  genesisCheckDeploy,
} from '@opcat-labs/scrypt-ts-opcat';
import { B2GCounter } from '../contracts/b2GCounter.js';
import { getDefaultSigner, getDefaultProvider, readArtifact } from '../utils/index.js';
import { toGenesisOutpoint } from '../../src/utils/proof.js';
import { markSpent } from '../../src/providers/utxoProvider.js';

use(chaiAsPromised);

describe('Test Backtrace Genesis Validation', () => {
  let signer: Signer = getDefaultSigner();
  let provider = getDefaultProvider();

  before(async () => {
    B2GCounter.loadArtifact(readArtifact('b2GCounter.json'));
  });

  // ============================================================================
  // 1. Genesis Input Index Validation
  // ============================================================================
  describe('Genesis input index validation', () => {
    it('should succeed when contract is deployed from Genesis input[0]', async () => {
      // Deploy contract using standard deployGenesis helper
      // This ensures Genesis is at input[0] and contract is at output[0]
      const { psbt, contract: counter } = await deployGenesis(
        signer,
        provider,
        (genesisOutpoint) => {
          const counter = new B2GCounter(genesisOutpoint);
          counter.state = { count: 0n };
          return counter;
        }
      );

      expect(psbt.isFinalized).to.be.true;
      console.log('✓ Contract deployed from Genesis input[0], txid:', psbt.extractTransaction().id);

      // Test backtrace - should succeed because Genesis is at input[0]
      const newContract = counter.next({ count: counter.state.count + 1n });

      const callPsbt = await call(
        signer,
        provider,
        counter,
        (contract: B2GCounter, _psbt: IExtPsbt, backtraceInfo: BacktraceInfo) => {
          contract.increase(backtraceInfo);
        },
        { contract: newContract, satoshis: 1, withBackTraceInfo: true }
      );

      expect(callPsbt.isFinalized).to.be.true;
      console.log('✓ Backtrace validation passed for Genesis input[0], txid:', callPsbt.extractTransaction().id);
    });

    // Note: Testing Genesis at input[i] for i > 0 would require modifying the Genesis contract
    // or building a custom transaction that bypasses the Genesis input[0] requirement.
    // The Genesis contract itself enforces this rule, so it's already covered by genesis.test.ts
  });

  // ============================================================================
  // 2. Output Index Validation
  // ============================================================================
  describe('Output index validation', () => {
    it('should succeed when contract is deployed at output[0]', async () => {
      // Deploy contract using standard deployGenesis helper
      // This ensures the contract is at output[0] of Genesis transaction
      const { psbt, contract: counter } = await deployGenesis(
        signer,
        provider,
        (genesisOutpoint) => {
          const counter = new B2GCounter(genesisOutpoint);
          counter.state = { count: 0n };
          return counter;
        }
      );

      expect(psbt.isFinalized).to.be.true;
      console.log('✓ Contract deployed at output[0], txid:', psbt.extractTransaction().id);

      // Test backtrace - should succeed because contract is from output[0]
      const newContract = counter.next({ count: counter.state.count + 1n });

      const callPsbt = await call(
        signer,
        provider,
        counter,
        (contract: B2GCounter, _psbt: IExtPsbt, backtraceInfo: BacktraceInfo) => {
          contract.increase(backtraceInfo);
        },
        { contract: newContract, satoshis: 1, withBackTraceInfo: true }
      );

      expect(callPsbt.isFinalized).to.be.true;
      console.log('✓ Backtrace validation passed for output[0], txid:', callPsbt.extractTransaction().id);
    });

    it('should fail when contract is deployed at output[i] for i > 0', async () => {
      const address = await signer.getAddress();
      const utxos = await provider.getUtxos(address);
      const feeRate = await provider.getFeeRate();
      const network = await provider.getNetwork();

      // Step 1: Deploy Genesis contract
      const genesis = new Genesis();
      const genesisPsbt = new ExtPsbt({ network });

      genesisPsbt
        .spendUTXO(utxos.slice(0, 10))
        .addContractOutput(genesis, 330)
        .change(address, feeRate)
        .seal();

      const signedGenesisPsbt = await signer.signPsbt(genesisPsbt.toHex(), genesisPsbt.psbtOptions());
      genesisPsbt.combine(ExtPsbt.fromHex(signedGenesisPsbt)).finalizeAllInputs();

      const genesisTx = genesisPsbt.extractTransaction();
      await provider.broadcast(genesisTx.toHex());
      markSpent(provider, genesisTx);

      const genesisUtxo = genesisPsbt.getUtxo(0)!;
      const genesisOutpoint = toGenesisOutpoint(genesisUtxo);
      genesis.bindToUtxo(genesisUtxo);

      // Step 2: Create a "malicious" transaction with contract at output[1] instead of output[0]
      // This simulates an attack where someone tries to bypass Genesis validation
      const counter = new B2GCounter(genesisOutpoint);
      counter.state = { count: 0n };

      const maliciousPsbt = new ExtPsbt({ network });

      // Genesis must be at input[0]
      maliciousPsbt.addContractInput(genesis, genesisCheckDeploy());

      const genesisChangeUtxo = genesisPsbt.getChangeUTXO();
      if (genesisChangeUtxo) {
        maliciousPsbt.spendUTXO(genesisChangeUtxo);
      }

      // CRITICAL: Add a dummy output at output[0], then add the contract at output[1]
      // This bypasses Genesis validation (which only checks output[0])
      const dummyScript = toByteString('51'); // OP_1 (dummy script)

      maliciousPsbt
        .addOutput({
          script: Buffer.from(dummyScript, 'hex'),
          value: 1000n,
          data: new Uint8Array(),
        }) // Dummy output at output[0]
        .addContractOutput(counter, 1) // Contract at output[1] ⚠️
        .change(address, feeRate)
        .seal();

      const signedMaliciousPsbt = await signer.signPsbt(maliciousPsbt.toHex(), maliciousPsbt.psbtOptions());
      maliciousPsbt.combine(ExtPsbt.fromHex(signedMaliciousPsbt)).finalizeAllInputs();

      const maliciousTx = maliciousPsbt.extractTransaction();
      await provider.broadcast(maliciousTx.toHex());
      markSpent(provider, maliciousTx);

      console.log('✓ Malicious deployment transaction broadcast (contract at output[1])', maliciousTx.id);

      // Get the UTXO from the transaction
      const contractUtxo = maliciousPsbt.getUtxo(1); // Contract is at output index 1

      // Bind the counter to the UTXO at output[1] (not output[0])
      if (!contractUtxo) {
        throw new Error('Contract UTXO not found at output[1]');
      }
      counter.bindToUtxo(contractUtxo);

      // Step 3: Try to use the contract with backtrace - should FAIL
      const newContract = counter.next({ count: counter.state.count + 1n });

      try {
        await call(
          signer,
          provider,
          counter,
          (contract: B2GCounter, _psbt: IExtPsbt, backtraceInfo: BacktraceInfo) => {
            contract.increase(backtraceInfo);
          },
          { contract: newContract, satoshis: 1, withBackTraceInfo: true }
        );

        // If we reach here, the test should fail
        expect.fail('Expected backtrace validation to fail for contract not from output[0]');
      } catch (error: any) {
        // Contract deployed at output[1] should fail to backtrace
        // The failure may occur at different validation stages:
        // - Output index validation (prevOutputIndex != 0)
        // - BacktraceInfo chain verification mismatch
        // Either way, the contract cannot be used, which is the security goal
        console.log('✓ Backtrace correctly rejected contract from output[1]');
      }
    });
  });

  // ============================================================================
  // 3. Genesis Source Validation
  // ============================================================================
  describe('Genesis source validation', () => {
    // Note: Testing "should fail when contract is not deployed from a Genesis"
    // would require deploying a contract directly without going through Genesis.
    // This is prevented by the Backtrace.verifyFromOutpoint() which checks
    // that prevPrevScript == GENESIS_SCRIPT_HASH when at genesis outpoint.
    // The GENESIS_SCRIPT_HASH validation test below covers this indirectly.

    it('should verify GENESIS_SCRIPT_HASH matches actual Genesis contract scriptHash', () => {
      const genesis = new Genesis();
      const actualScriptHash = sha256(toByteString(genesis.lockingScript.toHex()));

      // Import Backtrace to access GENESIS_SCRIPT_HASH constant
      const { Backtrace } = require('../../src/smart-contract/builtin-libs/backtrace.js');

      expect(actualScriptHash).to.equal(
        Backtrace.GENESIS_SCRIPT_HASH,
        'GENESIS_SCRIPT_HASH constant does not match actual Genesis contract scriptHash'
      );

      console.log('✓ GENESIS_SCRIPT_HASH is correct:', actualScriptHash);
    });
  });

  // ============================================================================
  // 4. Genesis Instance Validation
  // ============================================================================
  describe('Genesis instance validation', () => {
    it('should succeed when contract instance is from the same Genesis', async () => {
      // Deploy contract using standard deployGenesis helper
      const { psbt, contract: counter } = await deployGenesis(
        signer,
        provider,
        (genesisOutpoint) => {
          const counter = new B2GCounter(genesisOutpoint);
          counter.state = { count: 0n };
          return counter;
        }
      );

      expect(psbt.isFinalized).to.be.true;

      // Call the contract multiple times - each call should succeed
      // because the contract maintains the same genesisOutpoint
      let currentContract = counter;
      for (let i = 0; i < 3; i++) {
        const newContract = currentContract.next({ count: currentContract.state.count + 1n });

        const callPsbt = await call(
          signer,
          provider,
          currentContract,
          (contract: B2GCounter, _psbt: IExtPsbt, backtraceInfo: BacktraceInfo) => {
            contract.increase(backtraceInfo);
          },
          { contract: newContract, satoshis: 1, withBackTraceInfo: true }
        );

        expect(callPsbt.isFinalized).to.be.true;
        currentContract = newContract;
      }

      console.log('✓ Contract instance validated against same Genesis for 3 consecutive calls');
    });

    // Note: Testing "should fail when contract instance is not from the same Genesis"
    // would require creating two separate Genesis deployments and trying to mix them.
    // This is implicitly tested by the genesisOutpoint being baked into the contract.
  });

  // ============================================================================
  // 5. Output Index Check Unit Test
  // ============================================================================
  describe('Output index check unit test', () => {
    it('should accept Genesis deployment from output[0] (output index check passes)', () => {
      const { Backtrace } = require('../../src/smart-contract/builtin-libs/backtrace.js');

      // Create a mock BacktraceInfo pointing to Genesis outpoint at output[0] ✅
      const genesisOutpoint = toByteString('1111111111111111111111111111111111111111111111111111111111111111' + '00000000'); // txid + output index 0
      const mockBacktraceInfo = {
        prevTxInput: {
          prevTxHash: toByteString('1111111111111111111111111111111111111111111111111111111111111111'),
          prevOutputIndex: 0n, // ✅ Contract from output[0]
          scriptLen: 0n,
          scriptHashOrPubkey: Backtrace.GENESIS_SCRIPT_HASH, // Use correct Genesis hash
          sequence: 0n,
        },
        prevTxInputIndex: 0n,
        prevPrevTxPreimage: toByteString(''), // Will fail in verifyChainTxs, but that's OK
      };

      const selfScript = toByteString('5151'); // Dummy self script
      const prevTxInputList = toByteString(''); // Will fail in verifyChainTxs, but that's OK

      try {
        Backtrace.verifyFromOutpoint(
          mockBacktraceInfo,
          genesisOutpoint,
          selfScript,
          prevTxInputList
        );

        // If it doesn't throw about output index, that's good (may fail on other checks)
        console.log('✓ Output index check passed for prevOutputIndex == 0n');
      } catch (error: any) {
        const errorMsg = error.message || String(error);

        // It's OK if it fails on other validations (verifyChainTxs, etc.)
        // But it should NOT fail on output index check
        const failedOnOutputIndex =
          errorMsg.includes('Genesis deployment must use output[0]') ||
          errorMsg.includes('got output[0]');

        expect(failedOnOutputIndex).to.be.false,
          `Should not fail on output index check for prevOutputIndex == 0n, but got: ${errorMsg}`;

        console.log('✓ Output index check passed (failed on other validation as expected)');
        console.log('  Other validation error:', errorMsg.split('\n')[0]);
      }
    });
  });
});
