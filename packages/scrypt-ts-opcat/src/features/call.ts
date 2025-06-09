import { Covenant } from '../covenant.js';
import { ChainProvider, UtxoProvider } from '../providers/index.js';
import { markSpent } from '../providers/utxoProvider.js';
import { ExtPsbt } from '../psbt/extPsbt.js';
import { SubContractCall } from '../psbt/types.js';
import { Signer } from '../signer.js';

/**
 * call a covenant
 * @category Feature
 * @param signer a signer, such as {@link DefaultSigner}  or {@link UnisatSigner}
 * @param provider a  {@link UtxoProvider}
 * @param chainProvider a  {@link ChainProvider}
 * @param covenant the covenant
 * @returns the called psbt
 */
export async function call(
  signer: Signer,
  provider: UtxoProvider & ChainProvider,
  covenant: Covenant,
  subContractCall: SubContractCall,
  newCovenant?: { covenant: Covenant; satoshis: number },
): Promise<ExtPsbt> {
  const address = await signer.getAddress();

  const feeRate = await provider.getFeeRate();

  const utxos = await provider.getUtxos(address);

  const psbt = new ExtPsbt({ network: covenant.network })
    .addCovenantInput(covenant)
    .spendUTXO(utxos);

  if (newCovenant) {
    psbt.addCovenantOutput(newCovenant.covenant, newCovenant.satoshis);
  }
  psbt.change(address, feeRate);

  psbt.updateCovenantInput(0, covenant, subContractCall);
  psbt.seal();

  const signedPsbtHex = await signer.signPsbt(psbt.toHex(), psbt.psbtOptions());
  const signedPsbt = psbt.combine(ExtPsbt.fromHex(signedPsbtHex)).finalizeAllInputs();
  const callTx = signedPsbt.extractTransaction();
  await provider.broadcast(callTx.toHex());
  markSpent(provider, callTx);
  return signedPsbt;
}
