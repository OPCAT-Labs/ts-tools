import {
  PubKey,
  toHex,
  Signer,
  UtxoProvider,
  ChainProvider,
  UTXO,
  ExtPsbt,
  markSpent,
  getBackTraceInfo,
  Transaction,
  PubKeyHash,
} from '@opcat-labs/scrypt-ts-opcat'
import { TX_INPUT_COUNT_MAX } from '../../../contracts/constants'
import { filterFeeUtxos } from '../../../utils'
import { CAT20Admin } from '../../../contracts/cat20/cat20Admin'
import { OwnerUtils } from '../../../contracts'

/**
 * Change CAT20 admin owner in a single transaction.
 * @param signer a signer, such as {@link DefaultSigner} or {@link WalletSigner}
 * @param cat20Admin a CAT20Admin {@link CAT20Admin}
 * @param adminUtxo a utxo of cat20Admin {@link UTXO}
 * @param provider a  {@link UtxoProvider} & {@link ChainProvider}
 * @param newPubKeyHash a new admin owner address
 * @param feeRate the fee rate for constructing transactions
 * @returns a transferOwnership transaction
 */
export async function transferOwnership(
  signer: Signer,
  cat20Admin: CAT20Admin,
  adminUtxo: UTXO,
  provider: UtxoProvider & ChainProvider,
  newPubKeyHash: PubKeyHash,
  feeRate: number
): Promise<{
  sendPsbt: ExtPsbt
  sendTxId: string
}> {
  const changeAddress = await signer.getAddress()

  let utxos = await provider.getUtxos(changeAddress)
  utxos = filterFeeUtxos(utxos).slice(0, TX_INPUT_COUNT_MAX)

  if (utxos.length === 0) {
    throw new Error('Insufficient satoshis input amount')
  }

  /// we use the fee input as contract input;
  const sendPsbt = new ExtPsbt({ network: await provider.getNetwork() })
  // add admin input
  cat20Admin.bindToUtxo(adminUtxo)
  const pubkey = await signer.getPublicKey()
  const address = await signer.getAddress()
  const adminTxHex = await provider.getRawTransaction(adminUtxo.txId)
  const adminTx = new Transaction(adminTxHex)
  let prevAdminInputIndex = adminTx.inputs.length - 2
  if (prevAdminInputIndex < 0) {
    prevAdminInputIndex = 0
  }

  const spentAdminPreTxHex = await provider.getRawTransaction(
    toHex(adminTx.inputs[prevAdminInputIndex].prevTxId)
  )
  const backTraceInfo = getBackTraceInfo(
    adminTxHex,
    spentAdminPreTxHex,
    prevAdminInputIndex
  )
  sendPsbt.addContractInput(cat20Admin, (contract, tx) => {
    // sign admin input
    const sig = tx.getSig(0, {
      address: address.toString(),
    })
    contract.transferOwnership(
      PubKey(pubkey),
      sig,
      newPubKeyHash,
      backTraceInfo
    )
  })
  const newCat20Admin = cat20Admin.next({
    tag: cat20Admin.state.tag,
    adminAddress: OwnerUtils.pubKeyHashtoLockingScript(newPubKeyHash),
  })

  sendPsbt.addContractOutput(newCat20Admin, adminUtxo.satoshis)

  // add fee input, also is a contract input to unlock cat20
  sendPsbt.spendUTXO(utxos)
  sendPsbt.change(changeAddress, feeRate)
  sendPsbt.seal()

  const signedSendPsbt = await signer.signPsbt(
    sendPsbt.toHex(),
    sendPsbt.psbtOptions()
  )
  sendPsbt.combine(ExtPsbt.fromHex(signedSendPsbt))
  sendPsbt.finalizeAllInputs()

  const newFeeUtxo = sendPsbt.getChangeUTXO()!

  // broadcast
  await provider.broadcast(sendPsbt.extractTransaction().toHex())
  markSpent(provider, sendPsbt.extractTransaction())
  provider.addNewUTXO(newFeeUtxo)

  return {
    sendTxId: sendPsbt.extractTransaction().id,
    sendPsbt,
  }
}
