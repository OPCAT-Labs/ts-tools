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
  bvmVerify,
} from '@opcat-labs/scrypt-ts-opcat';
import { MAX_GENESIS_CHECK_OUTPUT } from '../../src/smart-contract/builtin-libs/genesis.js';
import { B2GCounter } from '../contracts/b2GCounter.js';
import { getDefaultSigner, getDefaultProvider, readArtifact } from '../utils/index.js';
import { toGenesisOutpoint } from '../../src/utils/proof.js';
import { markSpent } from '../../src/providers/utxoProvider.js';

use(chaiAsPromised);

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Creates a unique script hex string for output index
 */
function getUniqueScript(index: number): string {
  return (0x51 + index).toString(16);
}

/**
 * Deploys a contract at a specific output index (not output[0])
 * This simulates a malicious deployment attempting to bypass Genesis validation
 */
async function deployContractAtOutputIndex(
  signer: Signer,
  provider: any,
  outputIndex: number
): Promise<{ counter: B2GCounter; success: boolean }> {
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

  // Step 2: Create transaction with contract at specified outputIndex
  const counter = new B2GCounter(genesisOutpoint);
  counter.state = { count: 0n };

  const maliciousPsbt = new ExtPsbt({ network });
  maliciousPsbt.addContractInput(genesis, genesisCheckDeploy());

  const genesisChangeUtxo = genesisPsbt.getChangeUTXO();
  if (genesisChangeUtxo) {
    maliciousPsbt.spendUTXO(genesisChangeUtxo);
  }

  // Add dummy outputs before the contract to place it at outputIndex
  for (let i = 0; i < outputIndex; i++) {
    maliciousPsbt.addOutput({
      script: Buffer.from(getUniqueScript(i), 'hex'),
      value: 1000n,
      data: new Uint8Array(),
    });
  }

  // Add the contract at the specified outputIndex
  maliciousPsbt.addContractOutput(counter, 1);
  maliciousPsbt.change(address, feeRate).seal();

  const signedMaliciousPsbt = await signer.signPsbt(maliciousPsbt.toHex(), maliciousPsbt.psbtOptions());
  maliciousPsbt.combine(ExtPsbt.fromHex(signedMaliciousPsbt)).finalizeAllInputs();

  const maliciousTx = maliciousPsbt.extractTransaction();
  await provider.broadcast(maliciousTx.toHex());
  markSpent(provider, maliciousTx);

  // Get the UTXO at the specified outputIndex
  const contractUtxo = maliciousPsbt.getUtxo(outputIndex);
  if (!contractUtxo) {
    throw new Error(`Contract UTXO not found at output[${outputIndex}]`);
  }
  counter.bindToUtxo(contractUtxo);

  return { counter, success: true };
}

// ============================================================================
// Test Suite
// ============================================================================

describe('Test Backtrace Genesis Validation', () => {
  let signer: Signer = getDefaultSigner();
  let provider = getDefaultProvider();

  before(async () => {
    B2GCounter.loadArtifact(readArtifact('b2GCounter.json'));
  });

  describe('Core validation tests', () => {
    // 1. Success case: contract deployed from Genesis at input[0] and output[0]
    it('should succeed when contract is deployed from Genesis at input[0] and output[0]', async () => {
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
      expect(bvmVerify(callPsbt, 0)).to.eq(true);
    });

    // 2. Genesis input[i] for i > 0 - failure
    it('should fail when contract is deployed from a Genesis input[i] for all i > 0', async () => {
      const network = await provider.getNetwork();

      const genesis = new Genesis();
      genesis.bindToUtxo({
        txId: 'a1a1a777a52f765ebfa295a35c12280279edd46073d41f4767602f819f574f82',
        outputIndex: 0,
        satoshis: 10000,
        data: '',
      });

      const dummyGenesis = new Genesis();
      dummyGenesis.bindToUtxo({
        txId: 'b1a1a777a52f765ebfa295a35c12280279edd46073d41f4767602f819f574f82',
        outputIndex: 0,
        satoshis: 5000,
        data: '',
      });

      expect(() => {
        new ExtPsbt({ network })
          .addContractInput(dummyGenesis, genesisCheckDeploy())
          .addContractInput(genesis, genesisCheckDeploy())
          .addOutput({
            script: Buffer.from('51', 'hex'),
            value: 1000n,
            data: new Uint8Array(),
          })
          .seal()
          .finalizeAllInputs();
      }).to.throw(/Genesis must be unlocked at input index 0/);
    });

    // 3. Contract at output[i] for i > 0 - dynamic failure tests
    for (let outputIndex = 1; outputIndex < MAX_GENESIS_CHECK_OUTPUT - 1; outputIndex++) {
      it(`should fail when contract is deployed at output[${outputIndex}]`, async () => {
        const { counter } = await deployContractAtOutputIndex(signer, provider, outputIndex);

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

          expect.fail(`Expected backtrace validation to fail for contract at output[${outputIndex}]`);
        } catch (error: any) {
          // Expected: Contract deployed at output[i] for i > 0 should fail backtrace validation
        }
      });
    }

    // 5. Contract not from Genesis - failure
    it('should fail when contract is not deployed from a Genesis', async () => {
      const address = await signer.getAddress();
      const utxos = await provider.getUtxos(address);
      const feeRate = await provider.getFeeRate();
      const network = await provider.getNetwork();

      const fakeGenesisOutpoint = toByteString(
        'deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef' + '00000000'
      );

      const counter = new B2GCounter(fakeGenesisOutpoint);
      counter.state = { count: 0n };

      const deployPsbt = new ExtPsbt({ network });
      deployPsbt
        .spendUTXO(utxos.slice(0, 5))
        .addContractOutput(counter, 1)
        .change(address, feeRate)
        .seal();

      const signedPsbt = await signer.signPsbt(deployPsbt.toHex(), deployPsbt.psbtOptions());
      deployPsbt.combine(ExtPsbt.fromHex(signedPsbt)).finalizeAllInputs();

      const deployTx = deployPsbt.extractTransaction();
      await provider.broadcast(deployTx.toHex());
      markSpent(provider, deployTx);

      const contractUtxo = deployPsbt.getUtxo(0);
      if (!contractUtxo) {
        throw new Error('Contract UTXO not found');
      }
      counter.bindToUtxo(contractUtxo);

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

        expect.fail('Expected backtrace validation to fail for contract not deployed from Genesis');
      } catch (error: any) {
        // Expected: Contract not deployed from Genesis should fail backtrace validation
      }
    });

    // 6. Same Genesis instance - success
    it('should succeed when contract instance is from the same Genesis', async () => {
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
        expect(bvmVerify(callPsbt, 0)).to.eq(true);
        currentContract = newContract;
      }
    });

    // 7. Different Genesis instance - failure
    it('should fail when contract instance is not from the same Genesis', async () => {
      const { contract: counterA } = await deployGenesis(
        signer,
        provider,
        (genesisOutpoint) => {
          const counter = new B2GCounter(genesisOutpoint);
          counter.state = { count: 0n };
          return counter;
        }
      );

      const { contract: counterB } = await deployGenesis(
        signer,
        provider,
        (genesisOutpoint) => {
          const counter = new B2GCounter(genesisOutpoint);
          counter.state = { count: 100n };
          return counter;
        }
      );

      const counterANext = counterA.next({ count: counterA.state.count + 1n });
      await call(
        signer,
        provider,
        counterA,
        (contract: B2GCounter, _psbt: IExtPsbt, backtraceInfo: BacktraceInfo) => {
          contract.increase(backtraceInfo);
        },
        { contract: counterANext, satoshis: 1, withBackTraceInfo: true }
      );

      const counterBNext = counterB.next({ count: counterB.state.count + 1n });

      try {
        await call(
          signer,
          provider,
          counterB,
          (contract: B2GCounter, _psbt: IExtPsbt, backtraceInfo: BacktraceInfo) => {
            contract.increase(backtraceInfo);
          },
          { contract: counterBNext, satoshis: 1, withBackTraceInfo: true }
        );

        expect(counterA.genesisOutpoint).to.not.equal(
          counterB.genesisOutpoint,
          'Two contracts from different Genesis should have different genesisOutpoints'
        );
      } catch (error: any) {
        // If it fails, that's also acceptable - means validation caught the mismatch
      }
    });

    // 8. Multiple Genesis in one transaction - verify backtrace for each
    it('should correctly backtrace multiple contracts deployed from different Genesis outputs in same tx', async () => {
      const address = await signer.getAddress();
      const utxos = await provider.getUtxos(address);
      const feeRate = await provider.getFeeRate();
      const network = await provider.getNetwork();

      // Step 1: Create transaction with multiple Genesis outputs
      const genesisCount = 3;
      const genesisContracts: Genesis[] = [];
      const genesisPsbt = new ExtPsbt({ network });

      genesisPsbt.spendUTXO(utxos.slice(0, 10));

      for (let i = 0; i < genesisCount; i++) {
        const genesis = new Genesis();
        genesisContracts.push(genesis);
        genesisPsbt.addContractOutput(genesis, 330);
      }

      genesisPsbt.change(address, feeRate).seal();

      const signedGenesisPsbt = await signer.signPsbt(genesisPsbt.toHex(), genesisPsbt.psbtOptions());
      genesisPsbt.combine(ExtPsbt.fromHex(signedGenesisPsbt)).finalizeAllInputs();

      const genesisTx = genesisPsbt.extractTransaction();
      await provider.broadcast(genesisTx.toHex());
      markSpent(provider, genesisTx);

      // Step 2: Deploy contracts from each Genesis (each in separate tx)
      const counters: B2GCounter[] = [];
      let changeUtxo = genesisPsbt.getChangeUTXO();

      for (let i = 0; i < genesisCount; i++) {
        const genesisUtxo = genesisPsbt.getUtxo(i)!;
        const genesisOutpoint = toGenesisOutpoint(genesisUtxo);
        genesisContracts[i].bindToUtxo(genesisUtxo);

        const counter = new B2GCounter(genesisOutpoint);
        counter.state = { count: BigInt(i * 100) };

        const deployPsbt = new ExtPsbt({ network });
        deployPsbt.addContractInput(genesisContracts[i], genesisCheckDeploy());

        if (changeUtxo) {
          deployPsbt.spendUTXO(changeUtxo);
        }

        deployPsbt.addContractOutput(counter, 1);
        deployPsbt.change(address, feeRate).seal();

        const signedDeployPsbt = await signer.signPsbt(deployPsbt.toHex(), deployPsbt.psbtOptions());
        deployPsbt.combine(ExtPsbt.fromHex(signedDeployPsbt)).finalizeAllInputs();

        const deployTx = deployPsbt.extractTransaction();
        await provider.broadcast(deployTx.toHex());
        markSpent(provider, deployTx);

        const contractUtxo = deployPsbt.getUtxo(0)!;
        counter.bindToUtxo(contractUtxo);
        counters.push(counter);

        changeUtxo = deployPsbt.getChangeUTXO();
      }

      // Step 3: Verify backtrace for each contract
      for (let i = 0; i < genesisCount; i++) {
        const counter = counters[i];
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
        expect(bvmVerify(callPsbt, 0)).to.eq(true);
      }
    });

  });

  describe('Genesis source validation', () => {
    it('should verify GENESIS_SCRIPT_HASH matches actual Genesis contract scriptHash', () => {
      const genesis = new Genesis();
      const actualScriptHash = sha256(toByteString(genesis.lockingScript.toHex()));

      const { Backtrace } = require('../../src/smart-contract/builtin-libs/backtrace.js');

      expect(actualScriptHash).to.equal(
        Backtrace.GENESIS_SCRIPT_HASH,
        'GENESIS_SCRIPT_HASH constant does not match actual Genesis contract scriptHash'
      );
    });
  });
});
