import { ChainProvider, UtxoProvider } from '../providers/index.js';
import { markSpent } from '../providers/utxoProvider.js';
import { ExtPsbt } from '../psbt/extPsbt.js';
import { Signer } from '../signer.js';
import { SmartContract } from '../smart-contract/smartContract.js';
import { ByteString, OpcatState } from '../smart-contract/types/primitives.js';
import { toGenesisOutpoint } from '../utils/proof.js';
import { Genesis, genesisCheckDeploy } from '../smart-contract/builtin-libs/genesis.js';

/**
 * Default postage amount for Genesis contract output (in satoshis)
 */
const GENESIS_POSTAGE = 330;

/**
 * Deploys a smart contract, which can be traced back to genesis, to the blockchain.
 * This function uses a two-step deployment process:
 * 1. First deploys a Genesis contract
 * 2. Then deploys the target contract using the Genesis contract as input
 *
 * @param signer - The signer used to sign the transaction
 * @param provider - The provider for chain and UTXO data
 * @param createContract - Factory function to create the contract instance with genesis outpoint
 * @param satoshis - Amount of satoshis to lock in the contract (default: 1)
 * @returns Promise resolving to the deploy PSBT and deployed contract instance
 *
 * @remarks
 * This function:
 * 1. Creates and broadcasts a Genesis contract transaction
 * 2. Uses the Genesis contract as input to deploy the target contract
 * 3. Returns the finalized deploy PSBT and contract instance
 */
export async function deployGenesis<Contract extends SmartContract<OpcatState>>(
  signer: Signer,
  provider: UtxoProvider & ChainProvider,
  createContract: (genesisOutpoint: ByteString) => Contract,
  satoshis: number = 1,
): Promise<{
  psbt: ExtPsbt;
  contract: Contract;
}> {
  const address = await signer.getAddress();
  const utxos = await provider.getUtxos(address);
  const feeRate = await provider.getFeeRate();
  const network = await provider.getNetwork();

  // Step 1: Create and deploy Genesis contract
  const genesis = new Genesis();

  const genesisPsbt = new ExtPsbt({ network });
  genesisPsbt
    .spendUTXO(utxos.slice(0, 10))
    .addContractOutput(genesis, GENESIS_POSTAGE)
    .change(address, feeRate)
    .seal();

  const signedGenesisPsbt = await signer.signPsbt(genesisPsbt.toHex(), genesisPsbt.psbtOptions());
  genesisPsbt.combine(ExtPsbt.fromHex(signedGenesisPsbt)).finalizeAllInputs();

  // Broadcast genesis transaction
  const genesisTx = genesisPsbt.extractTransaction();
  await provider.broadcast(genesisTx.toHex());
  markSpent(provider, genesisTx);

  // Step 2: Create target contract with genesis outpoint
  const genesisUtxo = genesisPsbt.getUtxo(0)!;
  const genesisOutpoint = toGenesisOutpoint(genesisUtxo);
  const contract = createContract(genesisOutpoint);

  // Bind Genesis contract to its UTXO
  genesis.bindToUtxo(genesisUtxo);

  // Step 3: Deploy target contract using Genesis as input
  const deployPsbt = new ExtPsbt({ network });

  // Genesis must be at input index 0, so add it first
  deployPsbt.addContractInput(genesis, genesisCheckDeploy());

  // Add fee UTXO after Genesis input
  const genesisChangeUtxo = genesisPsbt.getChangeUTXO();
  if (genesisChangeUtxo) {
    deployPsbt.spendUTXO(genesisChangeUtxo);
  }

  deployPsbt
    .addContractOutput(contract, satoshis)
    .change(address, feeRate)
    .seal();

  const signedDeployPsbt = await signer.signPsbt(deployPsbt.toHex(), deployPsbt.psbtOptions());
  deployPsbt.combine(ExtPsbt.fromHex(signedDeployPsbt)).finalizeAllInputs();

  // Broadcast deploy transaction
  const deployTx = deployPsbt.extractTransaction();
  await provider.broadcast(deployTx.toHex());
  markSpent(provider, deployTx);

  const changeUTXO = deployPsbt.getChangeUTXO();
  if (changeUTXO) {
    provider.addNewUTXO(changeUTXO);
  }

  return { psbt: deployPsbt, contract };
}
