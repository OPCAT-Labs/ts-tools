import { ChainProvider, UtxoProvider } from '../providers/index.js';
import { markSpent } from '../providers/utxoProvider.js';
import { ExtPsbt } from '../psbt/extPsbt.js';
import { Signer } from '../signer.js';
import { SmartContract } from '../smart-contract/smartContract.js';
import { OpcatState } from '../smart-contract/types/primitives.js';
/**
 * Deploy a covenant
 * @category Feature
 * @param signer a signer, such as {@link DefaultSigner}  or {@link UnisatSigner}
 * @param provider a  {@link UtxoProvider}
 * @param chainProvider a  {@link ChainProvider}
 * @param contract the covenant
 * @returns the deployed psbt
 */
export async function deploy(
  signer: Signer,
  provider: UtxoProvider & ChainProvider,
  contract: SmartContract<OpcatState>,
  satoshis: number = 330,
  data: Uint8Array = new Uint8Array(0)
): Promise<ExtPsbt> {
  const address = await signer.getAddress();


  const utxos = await provider.getUtxos(address);

  const feeRate = await provider.getFeeRate();
  const network = await provider.getNetwork();
  const psbt = new ExtPsbt({ network: network });

  psbt.spendUTXO(utxos).addContractOutput(contract, satoshis, data).change(address, feeRate).seal();

  // sign the psbts
  const signedPsbtHex = await signer.signPsbt(psbt.toHex(), psbt.psbtOptions());

  // combine and finalize the signed psbts
  psbt.combine(ExtPsbt.fromHex(signedPsbtHex)).finalizeAllInputs();

  // broadcast the psbts
  const deployTx = psbt.extractTransaction();
  await provider.broadcast(deployTx.toHex());
  markSpent(provider, deployTx);

  return psbt;
}
