import { ExtPsbt, Signer, ChainProvider, UtxoProvider, hexToUint8Array, markSpent } from '@opcat-labs/scrypt-ts-opcat'
import { ClosedMinterCAT20Meta } from '../../../contracts'
import { CAT20TokenInfo, MetadataSerializer } from '../../../lib/metadata'
import { checkState } from '../../../utils/check'
import { CAT20ClosedMinter } from '../../../contracts/cat20/minters/cat20ClosedMinter'
import { CAT20Admin } from '../../../contracts/cat20/cat20Admin'
import { outpoint2ByteString, toTokenOwnerAddress } from '../../../utils'
import { CAT20 } from '../../../contracts/cat20/cat20'
import { ContractPeripheral, CAT20GuardPeripheral } from '../../../utils/contractPeripheral'
import {
  CAT20AdminState,
  CAT20ClosedMinterState,
} from '../../../contracts/cat20/types'
import { Postage } from '../../../typeConstants'
import { ConstantsLib } from '../../../contracts'


/**
 * Deploys a CAT20 token and its metadata using `CAT20ClosedMinter` contract
 * Only the token issuer can mint token
 * @category Feature
 * @param signer the signer for the deployer
 * @param provider the provider for the blockchain and UTXO operations
 * @param metadata the metadata for the token
 * @param feeRate the fee rate for the transaction
 * @param changeAddress the address for the change output
 * @returns the token info and the PSBTs for the genesis and deploy transactions
 */
export async function deployClosedMinterToken(
  signer: Signer,
  provider: ChainProvider & UtxoProvider,
  metadata: ClosedMinterCAT20Meta,
  feeRate: number,
  changeAddress?: string
): Promise<
  CAT20TokenInfo<ClosedMinterCAT20Meta> & {
    genesisPsbt: ExtPsbt
    deployPsbt: ExtPsbt
  }
> {
  const address = await signer.getAddress()
  const feeAddress = await signer.getAddress()

  changeAddress = changeAddress || feeAddress

  const utxos = await provider.getUtxos(feeAddress)
  checkState(utxos.length > 0, 'Insufficient satoshis')

  const genesisTx = new ExtPsbt({ network: await provider.getNetwork() })
    .spendUTXO(utxos)
    .change(changeAddress, feeRate, hexToUint8Array(MetadataSerializer.serialize('Token', { metadata })))
    .seal()

  const signedGenesisTx = await signer.signPsbt(
    genesisTx.toHex(),
    genesisTx.psbtOptions()
  )
  genesisTx.combine(ExtPsbt.fromHex(signedGenesisTx))
  genesisTx.finalizeAllInputs()

  const genesisUtxo = genesisTx.getChangeUTXO()!
  const tokenId = `${genesisUtxo.txId}_${genesisUtxo.outputIndex}`
  const closeMinter = new CAT20ClosedMinter(
    toTokenOwnerAddress(address),
    outpoint2ByteString(tokenId)
  )
  const admin = new CAT20Admin(outpoint2ByteString(tokenId))
  const minterScriptHash = ContractPeripheral.scriptHash(closeMinter)
  const adminScriptHash = ContractPeripheral.scriptHash(admin)
  const cat20 = new CAT20(
    minterScriptHash,
    CAT20GuardPeripheral.getGuardScriptHashes(),
    metadata.hasAdmin,
    adminScriptHash
  )
  const tokenScriptHash = ContractPeripheral.scriptHash(cat20)
  const minterState: CAT20ClosedMinterState = {
    tokenScriptHash,
  }
  const adminState: CAT20AdminState = {
    tag: ConstantsLib.OPCAT_CAT20_ADMIN_TAG,
    adminAddress: toTokenOwnerAddress(address),
  }

  closeMinter.state = minterState
  admin.state = adminState
  const deployTx = new ExtPsbt({ network: await provider.getNetwork() })
    .spendUTXO(genesisUtxo)
    .addContractOutput(closeMinter, Postage.MINTER_POSTAGE)
    .addContractOutput(admin, Postage.ADMIN_POSTAGE)
    .change(changeAddress, feeRate, hexToUint8Array(MetadataSerializer.serialize('Token', { metadata })))
    .seal()

  const signedDeployTx = await signer.signPsbt(
    deployTx.toHex(),
    deployTx.psbtOptions()
  )
  deployTx.combine(ExtPsbt.fromHex(signedDeployTx))
  deployTx.finalizeAllInputs()

  await provider.broadcast(genesisTx.extractTransaction().toHex())
  markSpent(provider, genesisTx.extractTransaction())
  await provider.broadcast(deployTx.extractTransaction().toHex())
  markSpent(provider, deployTx.extractTransaction())
  return {
    tokenId,
    tokenScriptHash,
    hasAdmin: metadata.hasAdmin,
    adminScriptHash,
    minterScriptHash,
    genesisPsbt: genesisTx,
    genesisTxid: genesisTx.extractTransaction().id,
    deployPsbt: deployTx,
    deployTxid: deployTx.extractTransaction().id,
    metadata,
    timestamp: Date.now(),
  }
}
