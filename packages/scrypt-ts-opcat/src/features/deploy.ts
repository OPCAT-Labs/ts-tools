import { Covenant } from '../covenant.js';
import { ChainProvider, UtxoProvider } from '../providers/index.js';
import { markSpent } from '../providers/utxoProvider.js';
import { ExtPsbt } from '../psbt/extPsbt.js';
import { Signer } from '../signer.js';
/**
 * Deploy a covenant
 * @category Feature
 * @param signer a signer, such as {@link DefaultSigner}  or {@link UnisatSigner}
 * @param provider a  {@link UtxoProvider}
 * @param chainProvider a  {@link ChainProvider}
 * @param covenant the covenant
 * @returns the deployed psbt
 */
export async function deploy(
  signer: Signer,
  provider: UtxoProvider & ChainProvider,
  covenant: Covenant,
  satoshis: number = 330,
): Promise<ExtPsbt> {
  const address = await signer.getAddress();

  const psbt = new ExtPsbt({ network: covenant.network });

  const utxos = await provider.getUtxos(address);

  const feeRate = await provider.getFeeRate();

  psbt.spendUTXO(utxos).addCovenantOutput(covenant, satoshis).change(address, feeRate).seal();

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
