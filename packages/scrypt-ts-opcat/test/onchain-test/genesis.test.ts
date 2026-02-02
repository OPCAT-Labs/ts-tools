import { use, expect } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import {
  Signer,
  deploy,
  ExtPsbt,
  ChainProvider,
  UtxoProvider,
} from '@opcat-labs/scrypt-ts-opcat';
import { network } from '../utils/privateKey.js';
import { createLogger, getDefaultProvider, getDefaultSigner } from '../utils/index.js';
import {
  Genesis,
  genesisCheckDeploy,
} from '../../src/smart-contract/builtin-libs/genesis.js';
import { markSpent } from '../../src/providers/utxoProvider.js';
import { Demo } from '../contracts/demo.js';
import demoArtifact from '../fixtures/demo.json' with { type: 'json' };

use(chaiAsPromised);

describe('Test Genesis onchain', () => {
  let signer: Signer;
  let provider: ChainProvider & UtxoProvider;
  let genesis: Genesis;
  let deployPsbt: ExtPsbt;
  const logger = createLogger('Test Genesis onchain');

  before(async () => {
    Demo.loadArtifact(demoArtifact);
    signer = getDefaultSigner();
    provider = getDefaultProvider(network);
  });

  it('should deploy Genesis successfully', async () => {
    genesis = new Genesis();
    deployPsbt = await deploy(signer, provider, genesis, 1);
    expect(deployPsbt.isFinalized).to.be.true;
    logger.info('Genesis deployed successfully, txid:', deployPsbt.extractTransaction().id);
    const changeUtxo = deployPsbt.getChangeUTXO();
    if (changeUtxo) {
      provider.addNewUTXO(changeUtxo);
    }
  });

  it('should spend Genesis successfully via checkDeploy', async () => {
    // Bind Genesis to the deployed UTXO
    const genesisUtxo = deployPsbt.getUtxo(0);
    expect(genesisUtxo).to.not.be.undefined;
    genesis.bindToUtxo(genesisUtxo!);

    // Get signer address for output
    const address = await signer.getAddress();

    // Get fee parameters
    const feeRate = await provider.getFeeRate();
    const networkType = await provider.getNetwork();

    // Get fee UTXO
    const utxos = await provider.getUtxos(address);
    expect(utxos.length).to.be.greaterThan(0, 'No UTXOs available for fees');

    // Create a new contract to deploy as output[0]
    // This ensures output[0] has a unique scriptHash (different from Genesis and P2PKH)
    const demo = new Demo(1n, 2n);

    // Build spend transaction
    // Genesis must be at input index 0
    const spendPsbt = new ExtPsbt({ network: networkType })
      .addContractInput(genesis, genesisCheckDeploy())
      .spendUTXO(utxos.slice(0, 5))
      .addContractOutput(demo, 1) // output[0] must have unique scriptHash
      .change(address, feeRate)
      .seal();

    // Sign the P2PKH inputs (skip contract input at index 0)
    const signedHex = await signer.signPsbt(spendPsbt.toHex(), spendPsbt.psbtOptions());
    spendPsbt.combine(ExtPsbt.fromHex(signedHex));

    // Finalize all inputs
    spendPsbt.finalizeAllInputs();
    expect(spendPsbt.isFinalized).to.be.true;

    // Broadcast transaction
    const spendTx = spendPsbt.extractTransaction();
    const txid = await provider.broadcast(spendTx.toHex());
    markSpent(provider, spendTx);

    logger.info('Genesis spent successfully, txid:', txid);
    logger.info('Demo contract deployed at output[0], txid:', txid);

    // Update provider with change UTXO
    const changeUtxo = spendPsbt.getChangeUTXO();
    if (changeUtxo) {
      provider.addNewUTXO(changeUtxo);
    }
  });
});
