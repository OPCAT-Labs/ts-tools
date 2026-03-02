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
 *
 * When hasAdmin is true, the deployment creates two Genesis outputs and deploys
 * Minter and Admin in separate transactions. This ensures both contracts are
 * deployed at output[0] of their respective deploy transactions, satisfying
 * the genesis validation requirement (prevOutputIndex must be 0).
 *
 * @category Feature
 * @param signer the signer for the deployer
 * @param provider the provider for the blockchain and UTXO operations
 * @param metadata the metadata for the token
 * @param feeRate the fee rate for the transaction
 * @param changeAddress the address for the change output
 * @returns the token info and the PSBTs for the genesis, deploy, and optional admin deploy transactions
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
    adminDeployPsbt?: ExtPsbt
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

  // Create genesis transaction with one or two Genesis outputs depending on hasAdmin
  const genesisTx = new ExtPsbt({ network: await provider.getNetwork() })
    .spendUTXO(utxos)
    .addContractOutput(genesis, Postage.GENESIS_POSTAGE)

  // If hasAdmin, create a second Genesis output for Admin deployment
  let adminGenesis: Genesis | undefined
  if (metadata.hasAdmin) {
    adminGenesis = new Genesis()
    adminGenesis.data = MetadataSerializer.serialize('Token', deployInfo)
    genesisTx.addContractOutput(adminGenesis, Postage.GENESIS_POSTAGE)
  }

  genesisTx.change(changeAddress, feeRate).seal()

  const signedGenesisTx = await signer.signPsbt(
    genesisTx.toHex(),
    genesisTx.psbtOptions()
  )
  genesisTx.combine(ExtPsbt.fromHex(signedGenesisTx))
  genesisTx.finalizeAllInputs()

  // Minter uses Genesis output[0]
  const genesisUtxo = genesisTx.getUtxo(0)!
  const tokenId = `${genesisUtxo.txId}_${genesisUtxo.outputIndex}`

  // Admin uses Genesis output[1] (if hasAdmin)
  const adminGenesisUtxo = metadata.hasAdmin ? genesisTx.getUtxo(1)! : undefined
  const adminTokenId = adminGenesisUtxo
    ? `${adminGenesisUtxo.txId}_${adminGenesisUtxo.outputIndex}`
    : undefined

  const closeMinter = new CAT20ClosedMinter(
    toTokenOwnerAddress(address),
    outpoint2ByteString(tokenId)
  )
  // Admin uses its own genesis outpoint (from output[1])
  const admin = metadata.hasAdmin
    ? new CAT20Admin(outpoint2ByteString(adminTokenId!))
    : new CAT20Admin(outpoint2ByteString(tokenId)) // fallback, won't be used
  const minterScriptHash = ContractPeripheral.scriptHash(closeMinter)
  const adminScriptHash = metadata.hasAdmin ? ContractPeripheral.scriptHash(admin) : NULL_ADMIN_SCRIPT_HASH;
  const cat20 = new CAT20(
    minterScriptHash,
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

  // Bind Genesis contract to UTXO (for minter)
  genesis.bindToUtxo(genesisTx.getUtxo(0))

  // Deploy Minter (output[0] of deployTx)
  const deployTx = new ExtPsbt({ network: await provider.getNetwork() })
    .addContractInput(genesis, genesisCheckDeploy())
    .spendUTXO(genesisTx.getChangeUTXO()!)
    .addContractOutput(closeMinter, Postage.MINTER_POSTAGE)
    .change(changeAddress, feeRate)
    .seal()

  const signedDeployTx = await signer.signPsbt(
    deployTx.toHex(),
    deployTx.psbtOptions()
  )
  deployTx.combine(ExtPsbt.fromHex(signedDeployTx))
  deployTx.finalizeAllInputs()

  // Broadcast genesis and minter deploy transactions
  await provider.broadcast(genesisTx.extractTransaction().toHex())
  markSpent(provider, genesisTx.extractTransaction())
  await provider.broadcast(deployTx.extractTransaction().toHex())
  markSpent(provider, deployTx.extractTransaction())

  // Deploy Admin separately if hasAdmin (output[0] of adminDeployTx)
  let adminDeployTx: ExtPsbt | undefined
  if (metadata.hasAdmin && adminGenesis && adminGenesisUtxo) {
    // Bind Admin Genesis to its UTXO (output[1] of genesisTx)
    adminGenesis.bindToUtxo(adminGenesisUtxo)

    adminDeployTx = new ExtPsbt({ network: await provider.getNetwork() })
      .addContractInput(adminGenesis, genesisCheckDeploy())
      .spendUTXO(deployTx.getChangeUTXO()!)
      .addContractOutput(admin, Postage.ADMIN_POSTAGE)
      .change(changeAddress, feeRate)
      .seal()

    const signedAdminDeployTx = await signer.signPsbt(
      adminDeployTx.toHex(),
      adminDeployTx.psbtOptions()
    )
    adminDeployTx.combine(ExtPsbt.fromHex(signedAdminDeployTx))
    adminDeployTx.finalizeAllInputs()

    await provider.broadcast(adminDeployTx.extractTransaction().toHex())
    markSpent(provider, adminDeployTx.extractTransaction())
    addChangeUtxoToProvider(provider, adminDeployTx)
  } else {
    addChangeUtxoToProvider(provider, deployTx)
  }

  return {
    tokenId,
    tokenScriptHash,
    hasAdmin: metadata.hasAdmin,
    adminScriptHash,
    adminGenesisOutpoint: adminTokenId,
    minterScriptHash,
    genesisPsbt: genesisTx,
    genesisTxid: genesisTx.extractTransaction().id,
    deployPsbt: deployTx,
    deployTxid: deployTx.extractTransaction().id,
    adminDeployPsbt: adminDeployTx,
    metadata,
    timestamp: Date.now(),
  }
})
