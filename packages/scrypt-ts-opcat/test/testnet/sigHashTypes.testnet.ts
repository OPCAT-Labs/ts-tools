/**
 * Testnet integration test for SigHashTypes feature
 *
 * This test deploys MultiSigHashMethods contract to testnet and verifies
 * all 6 SigHashType methods work correctly on-chain.
 *
 * Usage: cd packages/scrypt-ts-opcat && npx tsx test/testnet/sigHashTypes.testnet.ts
 */

import {
  DefaultSigner,
  ExtPsbt,
  PubKey,
  PrivateKey,
  OpenApiProvider,
  UTXO,
} from '../../src/index.js';
import { MultiSigHashMethods } from '../contracts/sigHashTypes.js';
import artifact from '../fixtures/multiSigHashMethods.json' with { type: 'json' };

// Testnet private key from environment variable
const TESTNET_PRIVATE_KEY = process.env.TESTNET_PRIVATE_KEY;
if (!TESTNET_PRIVATE_KEY) {
  throw new Error('TESTNET_PRIVATE_KEY environment variable is required');
}

// SigHashType values
const SigHashType = {
  ALL: 0x01 as const,
  NONE: 0x02 as const,
  SINGLE: 0x03 as const,
  ANYONECANPAY_ALL: 0x81 as const,
  ANYONECANPAY_NONE: 0x82 as const,
  ANYONECANPAY_SINGLE: 0x83 as const,
};

interface TestResult {
  method: string;
  sigHashType: number;
  deployTxId: string;
  unlockTxId: string;
  success: boolean;
  error?: string;
}

async function testSigHashType(
  signer: DefaultSigner,
  provider: OpenApiProvider,
  methodName: string,
  sigHashTypeValue: number,
  unlockMethod: (contract: MultiSigHashMethods, psbt: ExtPsbt, sig: any, pubKey: string, sigHashType: number) => void
): Promise<TestResult> {
  const result: TestResult = {
    method: methodName,
    sigHashType: sigHashTypeValue,
    deployTxId: '',
    unlockTxId: '',
    success: false,
  };

  try {
    const address = await signer.getAddress();
    const pubKey = await signer.getPublicKey();

    // 1. Get available UTXOs
    const utxos = await provider.getUtxos(address);
    if (utxos.length === 0) {
      throw new Error(`No UTXOs available for address ${address}`);
    }

    // Use the largest UTXO for funding
    const fundingUtxo = utxos.sort((a, b) => b.satoshis - a.satoshis)[0];
    console.log(`[${methodName}] Using UTXO: ${fundingUtxo.txId}:${fundingUtxo.outputIndex} (${fundingUtxo.satoshis} sats)`);

    // 2. Create and deploy contract
    const contract = new MultiSigHashMethods();

    // Create deploy PSBT
    const deployPsbt = new ExtPsbt({ network: signer.network })
      .spendUTXO({
        txId: fundingUtxo.txId,
        outputIndex: fundingUtxo.outputIndex,
        satoshis: fundingUtxo.satoshis,
        script: fundingUtxo.script,
        data: fundingUtxo.data || '',
      })
      .addContractOutput(contract, 1000)
      .change(address, 1)
      .seal();

    await deployPsbt.signAndFinalize(signer);
    const deployTx = deployPsbt.extractTransaction();
    result.deployTxId = deployTx.id;

    console.log(`[${methodName}] Deploying contract... txId: ${result.deployTxId}`);

    // Broadcast deploy transaction
    await provider.broadcast(deployTx.toHex());
    console.log(`[${methodName}] Deploy transaction broadcasted successfully`);

    // Mark the used UTXO as spent
    provider.markSpent(fundingUtxo.txId, fundingUtxo.outputIndex);

    // Wait for network propagation
    await new Promise(resolve => setTimeout(resolve, 3000));

    // 3. Create unlock transaction
    // Bind contract to the deployed UTXO
    contract.bindToUtxo({
      txId: result.deployTxId,
      outputIndex: 0,
      satoshis: 1000,
      data: '',
    });

    const unlockPsbt = new ExtPsbt({ network: signer.network })
      .addContractInput(contract, (c, psbt) => {
        const sig = psbt.getSig(0, { address, sighashTypes: [sigHashTypeValue] });
        unlockMethod(c, psbt, sig, pubKey, sigHashTypeValue);
      })
      .change(address, 1)
      .seal();

    await unlockPsbt.signAndFinalize(signer);
    const unlockTx = unlockPsbt.extractTransaction();
    result.unlockTxId = unlockTx.id;

    console.log(`[${methodName}] Unlocking contract... txId: ${result.unlockTxId}`);

    // Broadcast unlock transaction
    await provider.broadcast(unlockTx.toHex());
    console.log(`[${methodName}] Unlock transaction broadcasted successfully`);

    result.success = true;
    console.log(`[${methodName}] ✅ SUCCESS - SigHashType 0x${sigHashTypeValue.toString(16).padStart(2, '0')} verified on-chain\n`);

  } catch (error: any) {
    result.error = error.message || String(error);
    console.error(`[${methodName}] ❌ FAILED: ${result.error}\n`);
  }

  return result;
}

async function main() {
  console.log('='.repeat(60));
  console.log('SigHashTypes Testnet Integration Test');
  console.log('='.repeat(60));
  console.log();

  // Load artifact
  MultiSigHashMethods.loadArtifact(artifact);

  // Create signer with provided private key
  const privateKey = PrivateKey.fromWIF(TESTNET_PRIVATE_KEY);
  const signer = new DefaultSigner(privateKey);
  const provider = new OpenApiProvider('opcat-testnet');

  const address = await signer.getAddress();
  console.log(`Using address: ${address}`);
  console.log(`Network: ${signer.network}`);
  console.log();

  // Check balance
  const utxos = await provider.getUtxos(address);
  const balance = utxos.reduce((sum, utxo) => sum + utxo.satoshis, 0);
  console.log(`Available UTXOs: ${utxos.length}`);
  console.log(`Total balance: ${balance} satoshis`);
  console.log();

  if (balance < 5000) {
    console.error('Insufficient balance. Please fund the address with at least 5000 satoshis.');
    console.log(`Address to fund: ${address}`);
    process.exit(1);
  }

  const results: TestResult[] = [];

  // Test each SigHashType method
  console.log('-'.repeat(60));
  console.log('Testing SigHashType.ALL (unlockAll)');
  console.log('-'.repeat(60));
  results.push(await testSigHashType(signer, provider, 'unlockAll', SigHashType.ALL, (c, psbt, sig, pubKey, sigHashType) => {
    c.unlockAll(sig, PubKey(pubKey));
  }));

  // Wait between tests
  await new Promise(resolve => setTimeout(resolve, 2000));

  console.log('-'.repeat(60));
  console.log('Testing SigHashType.NONE (unlockNone)');
  console.log('-'.repeat(60));
  results.push(await testSigHashType(signer, provider, 'unlockNone', SigHashType.NONE, (c, psbt, sig, pubKey, sigHashType) => {
    c.unlockNone(sig, PubKey(pubKey));
  }));

  await new Promise(resolve => setTimeout(resolve, 2000));

  console.log('-'.repeat(60));
  console.log('Testing SigHashType.SINGLE (unlockSingle)');
  console.log('-'.repeat(60));
  results.push(await testSigHashType(signer, provider, 'unlockSingle', SigHashType.SINGLE, (c, psbt, sig, pubKey, sigHashType) => {
    c.unlockSingle(sig, PubKey(pubKey));
  }));

  await new Promise(resolve => setTimeout(resolve, 2000));

  console.log('-'.repeat(60));
  console.log('Testing SigHashType.ANYONECANPAY_ALL (unlockAnyoneCanPayAll)');
  console.log('-'.repeat(60));
  results.push(await testSigHashType(signer, provider, 'unlockAnyoneCanPayAll', SigHashType.ANYONECANPAY_ALL, (c, psbt, sig, pubKey, sigHashType) => {
    c.unlockAnyoneCanPayAll(sig, PubKey(pubKey));
  }));

  await new Promise(resolve => setTimeout(resolve, 2000));

  console.log('-'.repeat(60));
  console.log('Testing SigHashType.ANYONECANPAY_NONE (unlockAnyoneCanPayNone)');
  console.log('-'.repeat(60));
  results.push(await testSigHashType(signer, provider, 'unlockAnyoneCanPayNone', SigHashType.ANYONECANPAY_NONE, (c, psbt, sig, pubKey, sigHashType) => {
    c.unlockAnyoneCanPayNone(sig, PubKey(pubKey));
  }));

  await new Promise(resolve => setTimeout(resolve, 2000));

  console.log('-'.repeat(60));
  console.log('Testing SigHashType.ANYONECANPAY_SINGLE (unlockAnyoneCanPaySingle)');
  console.log('-'.repeat(60));
  results.push(await testSigHashType(signer, provider, 'unlockAnyoneCanPaySingle', SigHashType.ANYONECANPAY_SINGLE, (c, psbt, sig, pubKey, sigHashType) => {
    c.unlockAnyoneCanPaySingle(sig, PubKey(pubKey));
  }));

  // Summary
  console.log('='.repeat(60));
  console.log('TEST SUMMARY');
  console.log('='.repeat(60));
  console.log();

  const passed = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;

  console.log(`Passed: ${passed}/${results.length}`);
  console.log(`Failed: ${failed}/${results.length}`);
  console.log();

  console.log('Results:');
  console.log('-'.repeat(60));
  for (const result of results) {
    const status = result.success ? '✅' : '❌';
    console.log(`${status} ${result.method} (0x${result.sigHashType.toString(16).padStart(2, '0')})`);
    if (result.deployTxId) {
      console.log(`   Deploy: ${result.deployTxId}`);
    }
    if (result.unlockTxId) {
      console.log(`   Unlock: ${result.unlockTxId}`);
    }
    if (result.error) {
      console.log(`   Error: ${result.error}`);
    }
  }

  console.log();
  console.log('='.repeat(60));

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch(console.error);
