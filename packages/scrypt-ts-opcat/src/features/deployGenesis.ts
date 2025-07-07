import { Transaction } from '@opcat-labs/opcat';
import { ChainProvider, UtxoProvider } from '../providers/index.js';
import { markSpent } from '../providers/utxoProvider.js';
import { ExtPsbt } from '../psbt/extPsbt.js';
import { Signer } from '../signer.js';
import { SmartContract } from '../smart-contract/smartContract.js';
import { ByteString, OpcatState } from '../smart-contract/types/primitives.js';
import { toGenesisOutpoint } from '../utils/proof.js';

/**
 * Deploys a smart contract, which can be traced back to genesis, to the blockchain
 * 
 * @param signer - The signer used to sign the transaction
 * @param provider - The provider for chain and UTXO data
 * @param createContract - Factory function to create the contract instance with genesis outpoint
 * @param satoshis - Amount of satoshis to lock in the contract (default: 1)
 * @returns Promise resolving to the PSBT and deployed contract instance
 * 
 * @remarks
 * This function:
 * 1. Creates a genesis transaction from the first available UTXO
 * 2. Builds and signs the contract deployment PSBT
 * 3. Broadcasts the transaction and updates UTXO state
 * 4. Returns the finalized PSBT and contract instance
 */
export async function deployGenesis<Contract extends SmartContract<OpcatState>>(
  signer: Signer,
  provider: UtxoProvider & ChainProvider,
  createContract: (genesisOutpoint: ByteString) => Contract, // Function to create the contract with genesisOutpoint
  satoshis: number = 1,
): Promise<{
  psbt: ExtPsbt;
  contract: Contract;
}> {
  const address = await signer.getAddress();
  const utxos = await provider.getUtxos(address);

  const feeRate = await provider.getFeeRate();
  const network = await provider.getNetwork();
  const psbt = new ExtPsbt({ network: network });
  const genesisOutpoint = toGenesisOutpoint(utxos[0])
  const contract = createContract(genesisOutpoint); // Create contract with the txid of the psbt


  if (!('txHashPreimage' in utxos[0])) {
    const rawTx = await provider.getRawTransaction(utxos[0].txId);

    const txHashPreimage = Transaction.fromString(rawTx).toTxHashPreimage().toString('hex');

    Object.assign(utxos[0], {
      txHashPreimage: txHashPreimage
    })
  }

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

  return { psbt, contract };
}
