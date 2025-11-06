import {
  ExtPsbt,
  Signer,
  ChainProvider,
  UtxoProvider,
  hexToUint8Array,
  markSpent,
  sha256,
} from '@opcat-labs/scrypt-ts-opcat'
import { CAT20TokenInfo } from '../../../../src/lib/metadata'
import { checkState } from '../../../../src/utils/check'
import { CAT20ClosedMinter } from '../../../../src/contracts/cat20/minters/cat20ClosedMinter'
import { CAT20Admin } from '../../../../src/contracts/cat20/cat20Admin'
import { outpoint2ByteString, toTokenOwnerAddress } from '../../../../src/utils'
import { CAT20Guard } from '../../../../src/contracts/cat20/cat20Guard'
import { CAT20 } from '../../../../src/contracts/cat20/cat20'
import { ContractPeripheral } from '../../../../src/utils/contractPeripheral'
import {
  CAT20AdminState,
  CAT20ClosedMinterState,
  ClosedMinterCAT20Meta,
} from '../../../../src/contracts/cat20/types'
import { Postage } from '../../../../src/typeConstants'
import { CAT20ClosedMinterMetadata } from '../../../../src/contracts/cat20/minters/cat20ClosedMinterMetadata'
import { ConstantsLib } from '../../../../src/contracts'
export async function deploy(
  signer: Signer,
  provider: ChainProvider & UtxoProvider,
  metadata: ClosedMinterCAT20Meta,
  feeRate: number,
  changeAddress?: string
): Promise<
  CAT20TokenInfo<ClosedMinterCAT20Meta> & {
    genesisTx: ExtPsbt
    deployTx: ExtPsbt
  }
> {
  const address = await signer.getAddress()
  const feeAddress = await signer.getAddress()

  changeAddress = changeAddress || feeAddress

  const utxos = await provider.getUtxos(feeAddress)
  checkState(utxos.length > 0, 'Insufficient satoshis')

  const genesisTx = new ExtPsbt({ network: await provider.getNetwork() })
    .spendUTXO(utxos)
    .change(
      changeAddress,
      feeRate,
      hexToUint8Array(CAT20ClosedMinterMetadata.serializeState(metadata))
    )
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
  const guard = new CAT20Guard()
  const cat20 = new CAT20(
    minterScriptHash,
    ContractPeripheral.scriptHash(guard),
    metadata.hasAdmin,
    adminScriptHash
  )
  const tokenScriptHash = ContractPeripheral.scriptHash(cat20)
  const minterState: CAT20ClosedMinterState = {
    tag: ConstantsLib.OPCAT_MINTER_TAG,
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
    .change(
      changeAddress,
      feeRate,
      hexToUint8Array(CAT20ClosedMinterMetadata.serializeState(metadata))
    )
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
    genesisTx,
    genesisTxid: genesisTx.extractTransaction().id,
    deployTx,
    deployTxid: deployTx.extractTransaction().id,
    metadata,
    timestamp: Date.now(),
  }
}
