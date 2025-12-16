import { ExtPsbt, Signer, ChainProvider, UtxoProvider, markSpent, Genesis, genesisCheckDeploy, addChangeUtxoToProvider } from '@opcat-labs/scrypt-ts-opcat'
import { ClosedMinterCAT20Meta, NULL_ADMIN_SCRIPT_HASH } from '../../../contracts/index.js'
import { CAT20TokenInfo, ImageMimeTypes, MetadataSerializer } from '../../../lib/metadata.js'
import { checkState } from '../../../utils/check.js'
import { CAT20ClosedMinter } from '../../../contracts/cat20/minters/cat20ClosedMinter.js'
import { CAT20Admin } from '../../../contracts/cat20/cat20Admin.js'
import { outpoint2ByteString, toTokenOwnerAddress } from '../../../utils/index.js'
import { CAT20 } from '../../../contracts/cat20/cat20.js'
import { ContractPeripheral, CAT20GuardPeripheral } from '../../../utils/contractPeripheral.js'
import {
  CAT20AdminState,
  CAT20ClosedMinterState,
} from '../../../contracts/cat20/types.js'
import { Postage } from '../../../typeConstants.js'
import { ConstantsLib } from '../../../contracts/index.js'
import { createFeatureWithDryRun } from '../../../utils/index.js'


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
export const deployClosedMinterToken = createFeatureWithDryRun(async function(
  signer: Signer,
  provider: ChainProvider & UtxoProvider,
  deployInfo: {
    metadata: ClosedMinterCAT20Meta,
  },
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

  const { metadata } = deployInfo

  if (metadata.icon) {
    checkState(ImageMimeTypes.includes(metadata.icon.type), 'Invalid icon MIME type')
  }

  // Create Genesis contract instance and set metadata in its data field
  const genesis = new Genesis()
  genesis.data = MetadataSerializer.serialize('Token', deployInfo)

  const genesisTx = new ExtPsbt({ network: await provider.getNetwork() })
    .spendUTXO(utxos)
    .addContractOutput(genesis, Postage.GENESIS_POSTAGE)
    .change(changeAddress, feeRate)
    .seal()

  const signedGenesisTx = await signer.signPsbt(
    genesisTx.toHex(),
    genesisTx.psbtOptions()
  )
  genesisTx.combine(ExtPsbt.fromHex(signedGenesisTx))
  genesisTx.finalizeAllInputs()

  const genesisUtxo = genesisTx.getUtxo(0)!
  const tokenId = `${genesisUtxo.txId}_${genesisUtxo.outputIndex}`
  const closeMinter = new CAT20ClosedMinter(
    toTokenOwnerAddress(address),
    outpoint2ByteString(tokenId)
  )
  const admin = new CAT20Admin(outpoint2ByteString(tokenId))
  const minterScriptHash = ContractPeripheral.scriptHash(closeMinter)
  const adminScriptHash = metadata.hasAdmin ? ContractPeripheral.scriptHash(admin) : NULL_ADMIN_SCRIPT_HASH;
  const guardVariantScriptHashes = CAT20GuardPeripheral.getGuardVariantScriptHashes()
  const cat20 = new CAT20(
    minterScriptHash,
    guardVariantScriptHashes,
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

  // Bind Genesis contract to UTXO
  genesis.bindToUtxo(genesisTx.getUtxo(0))

  const deployTx = new ExtPsbt({ network: await provider.getNetwork() })
    .addContractInput(genesis, genesisCheckDeploy())
    .spendUTXO(genesisTx.getChangeUTXO()!)
    .addContractOutput(closeMinter, Postage.MINTER_POSTAGE)

  if (metadata.hasAdmin) {
    deployTx.addContractOutput(admin, Postage.ADMIN_POSTAGE)
  }

  deployTx
    .change(changeAddress, feeRate)
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
  addChangeUtxoToProvider(provider, deployTx)

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
})
