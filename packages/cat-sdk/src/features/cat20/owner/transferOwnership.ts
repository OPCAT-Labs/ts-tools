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
  ByteString,
} from '@opcat-labs/scrypt-ts-opcat'
import { TX_INPUT_COUNT_MAX } from '../../../contracts/constants'
import { filterFeeUtxos } from '../../../utils'
import { CAT20Admin } from '../../../contracts/cat20/cat20Admin'

/**
 * Change CAT20 admin owner in a single transaction.
 * @param signer a signer, such as {@link DefaultSigner} or {@link UnisatSigner}
 * @param cat20Admin a CAT20Admin {@link CAT20Admin}
 * @param adminUtxo a utxo of cat20Admin {@link UTXO}
 * @param provider a  {@link UtxoProvider} & {@link ChainProvider}
 * @param newAddress a new admin owner address
 * @param feeRate the fee rate for constructing transactions
 * @returns a transferOwnership transaction
 */
export async function transferOwnership(
  signer: Signer,
  cat20Admin: CAT20Admin,
  adminUtxo: UTXO,
  provider: UtxoProvider & ChainProvider,
  newAddress: ByteString,
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
  const spentMinterTxHex = await provider.getRawTransaction(adminUtxo.txId)
  const spentMinterTx = new Transaction(spentMinterTxHex)
  let minterInputIndex = spentMinterTx.inputs.length - 2
  if (minterInputIndex >= 0) {
  } else {
    minterInputIndex = 0
  }

  const spentMinterPreTxHex = await provider.getRawTransaction(
    toHex(spentMinterTx.inputs[minterInputIndex].prevTxId)
  )
  const backTraceInfo = getBackTraceInfo(
    spentMinterTxHex,
    spentMinterPreTxHex,
    minterInputIndex
  )
  sendPsbt.addContractInput(cat20Admin, (contract, tx) => {
    const sig = tx.getSig(0, {
      address: address.toString(),
    })
    // Todo
    contract.transferOwnership(PubKey(pubkey), sig, newAddress, backTraceInfo)
  })
  const newCat20Admin = cat20Admin.next({
    tag: cat20Admin.state.tag,
    ownerAddress: newAddress,
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
