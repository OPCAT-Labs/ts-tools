import { CAT20TokenInfo } from '../../../lib/metadata'
import { CAT20OpenMinter } from '../../../contracts/cat20/minters/cat20OpenMinter'
import { Postage } from '../../../typeConstants'
import {
  CAT20OpenMinterState,
  OpenMinterCAT20Meta,
} from '../../../contracts/cat20/types'
import { CAT20Guard } from '../../../contracts/cat20/cat20Guard'
import { CAT20 } from '../../../contracts/cat20/cat20'
import { checkState } from '../../../utils/check'
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
  hexToUint8Array,
  SupportedNetwork,
  getBackTraceInfo,
  toHex,
} from '@opcat-labs/scrypt-ts-opcat'
import {
  CAT20OpenMinterPeripheral,
  ContractPeripheral,
} from '../../../utils/contractPeripheral'
import { CAT20OpenMinterMetadata } from '../../../contracts/cat20/minters/cat20OpenMinterMetadata'
import { Transaction } from '@opcat-labs/opcat'
import {
  ConstantsLib,
  EMPTY_TOKEN_ADMIN_SCRIPT_HASH,
} from '../../../contracts/constants'

/**
 * Deploy a CAT20 token with metadata and automatically mint the pre-mined tokens, if applicable.
 * @param signer a signer, such as {@link DefaultSigner}  or {@link WalletSigner}
 * @param preminerSigner a signer, such as {@link DefaultSigner}  or {@link WalletSigner}
 * @param provider a  {@link UtxoProvider} & {@link ChainProvider}
 * @param metadata the metadata of the CAT20 token
 * @param feeRate the fee rate for constructing transactions
 * @param changeAddress the address to receive change satoshis, use the signer address as the default
 * @returns the genesis transaction, the token transaction and the premine transaction
 */
export async function deploy(
  // signer for deployer
  signer: Signer,
  // signer for preminer
  preminerSigner: Signer,
  provider: UtxoProvider & ChainProvider,
  metadata: OpenMinterCAT20Meta,
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

  const maxCount = metadata.max / metadata.limit
  const premineCount = metadata.premine / metadata.limit
  const remainingSupplyCount = maxCount - premineCount

  const genesisPsbt = new ExtPsbt({ network: await provider.getNetwork() })
    .spendUTXO(utxos)
    .change(
      changeAddress,
      feeRate,
      hexToUint8Array(CAT20OpenMinterMetadata.serializeState(metadata))
    )
    .seal()

  const signedGenesisPsbt = await signer.signPsbt(
    genesisPsbt.toHex(),
    genesisPsbt.psbtOptions()
  )
  genesisPsbt.combine(ExtPsbt.fromHex(signedGenesisPsbt))
  genesisPsbt.finalizeAllInputs()

  const genesisUtxo = genesisPsbt.getChangeUTXO()!
  const tokenId = `${genesisUtxo.txId}_${genesisUtxo.outputIndex}`

  const openMinter = CAT20OpenMinterPeripheral.createMinter(tokenId, metadata)
  openMinter.checkProps()

  const minterScriptHash = ContractPeripheral.scriptHash(openMinter)

  const adminScriptHash = EMPTY_TOKEN_ADMIN_SCRIPT_HASH

  const guard = new CAT20Guard()
  const cat20 = new CAT20(
    minterScriptHash,
    false,
    adminScriptHash,
    ContractPeripheral.scriptHash(guard)
  )
  const tokenScriptHash = ContractPeripheral.scriptHash(cat20)
  const minterState: CAT20OpenMinterState = {
    tag: ConstantsLib.OPCAT_MINTER_TAG,
    tokenScriptHash,
    hasMintedBefore: false,
    remainingCount: remainingSupplyCount,
  }

  openMinter.state = minterState
  const deployPsbt = new ExtPsbt({ network: await provider.getNetwork() })
    .spendUTXO(genesisUtxo)
    .addContractOutput(openMinter, Postage.MINTER_POSTAGE)
    .change(changeAddress, feeRate)
    .seal()

  const signedDeployPsbt = await signer.signPsbt(
    deployPsbt.toHex(),
    deployPsbt.psbtOptions()
  )
  deployPsbt.combine(ExtPsbt.fromHex(signedDeployPsbt))
  deployPsbt.finalizeAllInputs()

  const minterOutputIndex = 0
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
  spentMinter.bindToUtxo({
    ...spentMinterUtxo,
    txHashPreimage: toHex(new Transaction(spentMinterTxHex).toTxHashPreimage()),
  })
  mintPsbt
    .addContractOutput(cat20, Postage.TOKEN_POSTAGE)
    .addContractInput(spentMinter, (contract, tx) => {
      // if the minter has minted before, the metadata is empty to reduce tx size
      const _metadata = spentMinterState.hasMintedBefore
        ? CAT20OpenMinterMetadata.createEmptyMetadata()
        : metadata

      contract.mint(
        cat20State,
        splitAmountList,
        (isPremining ? PubKey(preminerPubKey!) : '') as PubKey,
        (isPremining
          ? tx.getSig(minterInputIndex, {
              publicKey: preminerPubKey,
            })
          : '') as Sig,
        BigInt(Postage.MINTER_POSTAGE),
        BigInt(Postage.TOKEN_POSTAGE),
        backTraceInfo,
        _metadata
      )
    })
    .spendUTXO(feeUtxos)
    .change(changeAddress, feeRate)
    .seal()

  return mintPsbt
}
