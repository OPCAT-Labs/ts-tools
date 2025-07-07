import { ChainProvider, UtxoProvider } from '../providers/index.js';
import { markSpent } from '../providers/utxoProvider.js';
import { ExtPsbt } from '../psbt/extPsbt.js';
import { Signer } from '../signer.js';
import { SmartContract } from '../smart-contract/smartContract.js';
import { OpcatState } from '../smart-contract/types/primitives.js';

/**
 * Deploys a smart contract to the blockchain.
 * 
 * @param signer - The signer used to sign the transaction
 * @param provider - The provider for UTXO and chain operations
 * @param contract - The smart contract instance to deploy
 * @param satoshis - The amount of satoshis to lock in the contract (default: 1)
 * @returns The finalized PSBT containing the deployment transaction
 * 
 * @remarks
 * This function handles the complete deployment flow:
 * 1. Collects UTXOs from the signer's address
 * 2. Creates and signs a PSBT with contract deployment output
 * 3. Broadcasts the transaction
 * 4. Manages UTXO updates (spent UTXOs and change)
 */
export async function deploy(
  signer: Signer,
  provider: UtxoProvider & ChainProvider,
  contract: SmartContract<OpcatState>,
  satoshis: number = 1,
): Promise<ExtPsbt> {
  const address = await signer.getAddress();


  const utxos = await provider.getUtxos(address);

  const feeRate = await provider.getFeeRate();
  const network = await provider.getNetwork();
  const psbt = new ExtPsbt({ network: network });

  psbt.spendUTXO(utxos.slice(0, 10))
    .addContractOutput(contract, satoshis)
    .change(address, feeRate)
    .seal();

  // sign the psbts
  const signedPsbtHex = await signer.signPsbt(psbt.toHex(), psbt.psbtOptions());

  // combine and finalize the signed psbts
  psbt.combine(ExtPsbt.fromHex(signedPsbtHex)).finalizeAllInputs();

  // broadcast the psbts
  const deployTx = psbt.extractTransaction();
  await provider.broadcast(deployTx.toHex());
  markSpent(provider, deployTx);
  const changeUTXO = psbt.getChangeUTXO();

  if (changeUTXO) {
    provider.addNewUTXO(changeUTXO);
  }

  return psbt;
}
