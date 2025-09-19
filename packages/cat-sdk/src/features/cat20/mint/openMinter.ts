import { buildMintPsbt } from '../deploy/openMinter'
import { CAT20OpenMinterPeripheral } from '../../../utils/contractPeripheral'
import { OpenMinterCAT20Meta } from '../../../contracts/cat20/types'
import {
  Signer,
  UtxoProvider,
  ChainProvider,
  UTXO,
  ExtPsbt,
  markSpent,
  ByteString,
  toHex,
} from '@opcat-labs/scrypt-ts-opcat'
import { Transaction } from '@opcat-labs/opcat'
import { CAT20OpenMinter } from '../../../contracts'

/**
 * Mint CAT20 tokens in a single transaction.
 * @param signer a signer, such as {@link DefaultSigner} or {@link UnisatSigner}
 * @param preminerSigner a signer, such as {@link DefaultSigner}  or {@link WalletSigner}
 * @param provider a  {@link UtxoProvider} & {@link ChainProvider}
 * @param minterUtxo an UTXO that contains the minter of the CAT20 token
 * @param tokenId the id of the CAT20 token
 * @param metadata the metadata of the CAT20 token
 * @param tokenReceiver the recipient's address of the newly minted tokens
 * @param changeAddress the address to receive change satoshis, use the signer address as the default
 * @param feeRate the fee rate for constructing transactions
 * @returns the mint transaction
 */
export async function mint(
  signer: Signer,
  preminerSigner: Signer,
  provider: UtxoProvider & ChainProvider,
  minterUtxo: UTXO,
  tokenId: string,
  metadata: OpenMinterCAT20Meta,
  tokenReceiver: ByteString,
  changeAddress: string,
  feeRate: number
): Promise<{
  mintPsbt: ExtPsbt
  mintTxid: string
}> {
  const address = await signer.getAddress()
  const pubkey = await signer.getPublicKey()

  // fetch minter preTx
  const minterInputIndex = 0
  const spentMinterTxHex = await provider.getRawTransaction(minterUtxo.txId)
  const spentMinterTx = new Transaction(spentMinterTxHex)
  const minterPreTxHex = await provider.getRawTransaction(
    toHex(spentMinterTx.inputs[minterInputIndex].prevTxId)
  )

  const premineCount = metadata.premine / metadata.limit

  const utxos = await provider.getUtxos(address)
  const openMinter = CAT20OpenMinterPeripheral.createMinter(tokenId, metadata)

  const mintPsbt = buildMintPsbt(
    minterPreTxHex,
    spentMinterTxHex,
    openMinter,
    minterUtxo,
    tokenReceiver,
    utxos,
    feeRate,
    await provider.getNetwork(),
    changeAddress,
    metadata,
    pubkey
  )

  const state = CAT20OpenMinter.deserializeState(minterUtxo.data)
  const signedPsbt = await signer.signPsbt(
    mintPsbt.toHex(),
    mintPsbt.psbtOptions()
  )
  mintPsbt.combine(ExtPsbt.fromHex(signedPsbt))

  if (!state!.hasMintedBefore && premineCount > 0) {
    const signedPsbt = await preminerSigner.signPsbt(
      mintPsbt.toHex(),
      mintPsbt.psbtOptions()
    )
    mintPsbt.combine(ExtPsbt.fromHex(signedPsbt))
  }

  mintPsbt.finalizeAllInputs()

  await provider.broadcast(mintPsbt.extractTransaction().toHex())
  markSpent(provider, mintPsbt.extractTransaction())

  return {
    mintPsbt,
    mintTxid: mintPsbt.extractTransaction().id,
  }
}
