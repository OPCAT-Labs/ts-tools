import { ChainProvider, UtxoProvider } from '../providers/index.js';
import { markSpent } from '../providers/utxoProvider.js';
import { ExtPsbt } from '../psbt/extPsbt.js';
import { ContractCall } from '../psbt/types.js';
import { Signer } from '../signer.js';
import { SmartContract } from '../smart-contract/smartContract.js';
import { OpcatState } from '../smart-contract/types/primitives.js';

/**
 * call a contract
 * @category Feature
 * @param signer a signer, such as {@link DefaultSigner}  or {@link UnisatSigner}
 * @param provider a {@link UtxoProvider} & {@link ChainProvider}
 * @param contract the contract
 * @param contractCall the contract call function, such as `(contract: Counter) => { contract.increase() }`
 * @param newContract the new contract, such as `{ contract: newContract, satoshis: 1 }`
 * @returns the called psbt
 */
export async function call(
  signer: Signer,
  provider: UtxoProvider & ChainProvider,
  contract: SmartContract<OpcatState>,
  contractCall: ContractCall,
  newContract?: { contract: SmartContract<OpcatState>; satoshis: number},
): Promise<ExtPsbt> {
  const address = await signer.getAddress();

  const feeRate = await provider.getFeeRate();

  const utxos = await provider.getUtxos(address);

  const network = await provider.getNetwork();

  const psbt = new ExtPsbt({ network: network })
    .addContractInput(contract)
    .spendUTXO(utxos.slice(0, 10));

  if (newContract) {
    psbt.addContractOutput(newContract.contract, newContract.satoshis);
  }
  psbt.change(address, feeRate);

  psbt.updateContractInput(0, contractCall);
  psbt.seal();

  const signedPsbtHex = await signer.signPsbt(psbt.toHex(), psbt.psbtOptions());
  const signedPsbt = psbt.combine(ExtPsbt.fromHex(signedPsbtHex)).finalizeAllInputs();
  const callTx = signedPsbt.extractTransaction();
  await provider.broadcast(callTx.toHex());
  markSpent(provider, callTx);
  return signedPsbt;
}
