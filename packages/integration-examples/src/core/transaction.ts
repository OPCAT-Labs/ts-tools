import type { AddressAmount } from "../hooks/useTransfer";
import { ExtPsbt, MempoolProvider, Script, sha256, type Signer, type SupportedNetwork } from "@opcat-labs/scrypt-ts-opcat";
import { CAT20_TRACKER_URL, CatTrackerApi, type Cat20Balance } from "./cat20";
import { CAT20, CAT20Guard, singleSend } from "@opcat-labs/cat-sdk";

 
export async function transferSats(recipients: AddressAmount[], signer: Signer, network: SupportedNetwork) {
  const decimals = 8;
  const provider = new MempoolProvider(network);
  const utxos = await provider.getUtxos(await signer.getAddress());
  // sort utxos by satoshis in descending order
  utxos.sort((a, b) => b.satoshis - a.satoshis);
  const balanceSat = utxos.reduce((acc, utxo) => acc + utxo.satoshis, 0);
  const totalAmount = recipients.reduce((acc, recipient) => acc + Math.round( recipient.amount * 10 ** decimals), 0);
  if (totalAmount > balanceSat) {
    throw new Error('Insufficient balance');
  }
  const psbt = new ExtPsbt({network: network})
    .spendUTXO(utxos)
  
  for (const recipient of recipients) {
    psbt.addOutput({
      address: recipient.address,
      value: BigInt(Math.round(recipient.amount * 10 ** decimals)),
      data: Buffer.alloc(0)
    });
  }
  psbt
    .change(await signer.getAddress(), await provider.getFeeRate())
    .seal()
  const signedPsbt = await signer.signPsbt(psbt.toHex(), psbt.psbtOptions())
  psbt.combine(ExtPsbt.fromHex(signedPsbt)).finalizeAllInputs()
  const tx = psbt.extractTransaction();
  await provider.broadcast(tx.toHex());
  return tx.id;
}

export async function transferCat20(token: Cat20Balance, recipients: AddressAmount[], signer: Signer, network: SupportedNetwork) {
  const totalOutput = recipients.reduce((acc, recipient) => acc + Math.round( recipient.amount * 10 ** token.token.decimals), 0);
  if (totalOutput > Number(token.balance)) {
    throw new Error('Insufficient balance');
  }

  const senderAddress = await signer.getAddress();

  const cat20Utxos = await new CatTrackerApi(CAT20_TRACKER_URL).getAddressTokenUtxoList(token.token.tokenId, senderAddress)
  cat20Utxos.utxos.sort((a, b) => Number(BigInt(b.state.amount) - BigInt(a.state.amount)));

  const cat20Script = new CAT20(token.token.minterScriptHash, sha256(new CAT20Guard().lockingScript.toHex())).lockingScript.toHex()

  
  const res = await singleSend(
    signer,
    new MempoolProvider(network),
    token.token.minterScriptHash,
    cat20Utxos.utxos.map(utxo => ({
      txId: utxo.txId,
      outputIndex: utxo.outputIndex,
      script: cat20Script,
      satoshis: Number(utxo.satoshis),
      data: utxo.data,
    })),
    recipients.map(recipient => ({address: Script.fromAddress(recipient.address).toHex(), amount: BigInt(Math.round(recipient.amount * 10 ** token.token.decimals))})),
    Script.fromAddress(senderAddress).toHex(),
    await new MempoolProvider(network).getFeeRate(),
  )
  
  return res.sendTxId
}


export function txExplorerUrl(txid: string, network: SupportedNetwork) {
  if (network === 'opcat-testnet') {
    return `https://testnet.opcatlabs.io/tx/${txid}`;
  }
  return `https://opcatlabs.io/tx/${txid}`;
}

