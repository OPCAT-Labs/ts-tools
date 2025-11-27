import { CAT20TokenInfo, ImageMimeTypes, MetadataSerializer } from '../../../lib/metadata.js'
import { CAT20OpenMinter } from '../../../contracts/cat20/minters/cat20OpenMinter.js'
import { Postage } from '../../../typeConstants.js'
import {
  CAT20OpenMinterState,
  OpenMinterCAT20Meta,
} from '../../../contracts/cat20/types.js'
import { CAT20 } from '../../../contracts/cat20/cat20.js'
import { checkState } from '../../../utils/check.js'
import {
  ByteString,
  PubKey,
  Sig,
  Signer,
  ExtPsbt,
  UTXO,
  markSpent,
  UtxoProvider,
  ChainProvider,
  SupportedNetwork,
  getBackTraceInfo,
  toHex,
  Genesis,
  genesisCheckDeploy,
} from '@opcat-labs/scrypt-ts-opcat'
import {
  CAT20GuardPeripheral,
  CAT20OpenMinterPeripheral,
  ContractPeripheral,
} from '../../../utils/contractPeripheral.js'
import { Transaction } from '@opcat-labs/opcat'
import {
  NULL_ADMIN_SCRIPT_HASH,
} from '../../../contracts/constants.js'

/**
 * Deploys a CAT20 token and its metadata using `CAT20OpenMinter` contract, and premines the token if applicable.
 * The preimner can mint the token with premined amount first, other users can mint the token with a fixed amount later
 * @category Feature
 * @param signer the signer for the deployer
 * @param preminerSigner the signer for the preminer, pass the deployer signer if premine is disabled, otherwise pass the reminer signer
 * @param provider the provider for the blockchain and UTXO operations
 * @param metadata the metadata for the token
 * @param feeRate the fee rate for the transaction
 * @param icon the icon for the token, optional. If provided, it should contain `type` and `body`, where `type` is the MIME type and `body` is the binary data in hex string
 * @param changeAddress the address for the change output
 * @returns the token info and the PSBTs for the genesis, deploy, and premine transactions
 */
export async function deployOpenMinterToken(
  // signer for deployer
  signer: Signer,
  // signer for preminer
  preminerSigner: Signer,
  provider: UtxoProvider & ChainProvider,
  deployInfo: {
    metadata: OpenMinterCAT20Meta,
  },
  feeRate: number,
  changeAddress?: string
): Promise<
  CAT20TokenInfo<OpenMinterCAT20Meta> & {
    genesisPsbt: ExtPsbt
    deployPsbt: ExtPsbt
    preminePsbt?: ExtPsbt
  }
> {
  const address = await signer.getAddress()
  changeAddress = changeAddress || address

  const utxos = await provider.getUtxos(address)
  checkState(utxos.length > 0, 'Insufficient satoshis')

  const { metadata } = deployInfo

  const maxCount = metadata.max / metadata.limit
  const premineCount = metadata.premine / metadata.limit
  const remainingSupplyCount = maxCount - premineCount

  if (metadata.icon) {
    checkState(ImageMimeTypes.includes(metadata.icon.type), 'Invalid icon MIME type')
  }

  // Create Genesis contract instance and set metadata in its data field
  const genesis = new Genesis()
  genesis.data = MetadataSerializer.serialize('Token', deployInfo)

  const genesisPsbt = new ExtPsbt({ network: await provider.getNetwork() })
    .spendUTXO(utxos)
    .addContractOutput(genesis, Postage.GENESIS_POSTAGE)
    .change(changeAddress, feeRate)
    .seal()

  const signedGenesisPsbt = await signer.signPsbt(
    genesisPsbt.toHex(),
    genesisPsbt.psbtOptions()
  )
  genesisPsbt.combine(ExtPsbt.fromHex(signedGenesisPsbt))
  genesisPsbt.finalizeAllInputs()

  const genesisUtxo = genesisPsbt.getUtxo(0)!
  const tokenId = `${genesisUtxo.txId}_${genesisUtxo.outputIndex}`

  const openMinter = CAT20OpenMinterPeripheral.createMinter(tokenId, metadata)
  openMinter.checkProps()

  const minterScriptHash = ContractPeripheral.scriptHash(openMinter)

  const adminScriptHash = NULL_ADMIN_SCRIPT_HASH

  const cat20 = new CAT20(
    minterScriptHash,
    CAT20GuardPeripheral.getGuardVariantScriptHashes(),
    false,
    adminScriptHash
  )
  const tokenScriptHash = ContractPeripheral.scriptHash(cat20)
  const minterState: CAT20OpenMinterState = {
    tokenScriptHash,
    hasMintedBefore: false,
    remainingCount: remainingSupplyCount,
  }

  openMinter.state = minterState

  // Bind Genesis contract to UTXO with metadata
  genesis.bindToUtxo(genesisPsbt.getUtxo(0))

  const deployPsbt = new ExtPsbt({ network: await provider.getNetwork() })
    .addContractInput(genesis, genesisCheckDeploy())
    .spendUTXO(genesisPsbt.getChangeUTXO()!)
    .addContractOutput(openMinter, Postage.MINTER_POSTAGE)
    .change(changeAddress, feeRate)
    .seal()

  const signedDeployPsbt = await signer.signPsbt(
    deployPsbt.toHex(),
    deployPsbt.psbtOptions()
  )
  deployPsbt.combine(ExtPsbt.fromHex(signedDeployPsbt))
  deployPsbt.finalizeAllInputs()

  const minterOutputIndex = 0  // Minter is now at output index 0
  const deployUtxo = deployPsbt.getUtxo(minterOutputIndex)

  // build premine tx if applicable
  let preminePsbt: ExtPsbt | undefined
  if (metadata.premine > 0n && metadata.preminerAddr) {
    preminerSigner.getAddress()
    preminePsbt = buildMintPsbt(
      genesisPsbt.extractTransaction().toHex(),
      deployPsbt.extractTransaction().toHex(),
      openMinter,
      deployUtxo,
      metadata.preminerAddr,
      [deployPsbt.getChangeUTXO()!],
      feeRate,
      await provider.getNetwork(),
      changeAddress,
      metadata,
      await preminerSigner.getPublicKey()
    )
    const signedTx1 = await preminerSigner.signPsbt(
      preminePsbt.toHex(),
      preminePsbt.psbtOptions()
    )
    preminePsbt.combine(ExtPsbt.fromHex(signedTx1))
    preminePsbt.finalizeAllInputs()

    if ((await preminerSigner.getAddress()) !== address) {
      const signedTx2 = await signer.signPsbt(
        preminePsbt.toHex(),
        preminePsbt.psbtOptions()
      )
      preminePsbt.combine(ExtPsbt.fromHex(signedTx2))
      preminePsbt.finalizeAllInputs()
    }
  }

  await provider.broadcast(genesisPsbt.extractTransaction().toHex())
  markSpent(provider, genesisPsbt.extractTransaction())
  await provider.broadcast(deployPsbt.extractTransaction().toHex())
  markSpent(provider, deployPsbt.extractTransaction())
  if (preminePsbt) {
    await provider.broadcast(preminePsbt.extractTransaction().toHex())
    markSpent(provider, preminePsbt.extractTransaction())
  }

  return {
    tokenId,
    minterScriptHash,
    hasAdmin: false,
    adminScriptHash,
    tokenScriptHash,

    genesisTxid: genesisPsbt.extractTransaction().id,
    deployTxid: deployPsbt.extractTransaction().id,
    metadata: metadata,
    timestamp: new Date().getTime(),

    genesisPsbt,
    deployPsbt,
    preminePsbt,
  }
}

export function buildMintPsbt(
  spentMinterPreTxHex: string,
  spentMinterTxHex: string,
  spentMinter: CAT20OpenMinter,
  spentMinterUtxo: UTXO,
  tokenReceiver: ByteString,
  feeUtxos: UTXO[],
  feeRate: number,
  network: SupportedNetwork,
  changeAddress: string,
  metadata: OpenMinterCAT20Meta,
  preminerPubKey?: string
) {
  const spentMinterState = CAT20OpenMinter.deserializeState(
    spentMinterUtxo.data
  )
  if (!spentMinterState) {
    throw new Error('Minter state is not available')
  }

  const isPremining =
    !spentMinterState.hasMintedBefore && spentMinter.premine > 0

  if (isPremining && !preminerPubKey) {
    throw new Error('Preminer info is required for premining')
  }

  const mintPsbt = new ExtPsbt({ network: network })

  const { nextMinterStates, splitAmountList } =
    CAT20OpenMinterPeripheral.createNextMinters(spentMinter, spentMinterState)

  for (const nextMinterState of nextMinterStates) {
    const clonedMinter = spentMinter.next(nextMinterState)
    mintPsbt.addContractOutput(clonedMinter, Postage.MINTER_POSTAGE)
  }

  const [cat20, cat20State] = CAT20OpenMinterPeripheral.createCAT20Contract(
    spentMinter,
    spentMinterState,
    tokenReceiver
  )

  const minterInputIndex = 0
  const backTraceInfo = getBackTraceInfo(
    spentMinterTxHex,
    spentMinterPreTxHex,
    minterInputIndex
  )

  cat20.state = cat20State
  spentMinter.bindToUtxo({ ...spentMinterUtxo, txHashPreimage: toHex(new Transaction(spentMinterTxHex).toTxHashPreimage()) })
  mintPsbt
    .addContractOutput(
      cat20,
      Postage.TOKEN_POSTAGE
    )
    .addContractInput(spentMinter, (contract, tx) => {
      contract.mint(
        cat20State,
        splitAmountList,
        (isPremining
          ? PubKey(preminerPubKey!)
          : '') as PubKey,
        (isPremining
          ? tx.getSig(minterInputIndex, {
            publicKey: preminerPubKey,
          })
          : '') as Sig,
        BigInt(Postage.MINTER_POSTAGE),
        BigInt(Postage.TOKEN_POSTAGE),
        backTraceInfo
      )
    })
    .spendUTXO(feeUtxos)
    .change(changeAddress, feeRate)
    .seal()

  return mintPsbt
}
