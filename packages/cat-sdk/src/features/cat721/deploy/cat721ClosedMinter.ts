import { ByteString, ChainProvider, ExtPsbt, markSpent, Signer, UTXO, UtxoProvider, Genesis, genesisCheckDeploy } from "@opcat-labs/scrypt-ts-opcat";
import { ClosedMinterCAT721Meta } from "../../../contracts/cat721/types.js";
import { CAT721NftInfo } from "../../../lib/metadata.js";
import { filterFeeUtxos, normalizeUtxoScripts } from "../../../utils/index.js";
import { checkState } from "../../../utils/check.js";
import { CAT721ClosedMinterPeripheral, ContractPeripheral, CAT721GuardPeripheral } from "../../../utils/contractPeripheral.js";
import { TX_INPUT_COUNT_MAX } from "../../../contracts/constants.js";
import { Postage } from "../../../typeConstants.js";
import { CAT721 } from "../../../contracts/cat721/cat721.js";
import { CAT721ClosedMinterState } from "../../../contracts/cat721/types.js";
import { MetadataSerializer } from "../../../lib/metadata.js";


/**
 * Deploys a CAT721 closed minter and its metadata using `CAT721ClosedMinter` contract
 * Only the token issuer can mint token
 * @category Feature
 * @param signer the signer for the deployer
 * @param provider the provider for the blockchain and UTXO operations
 * @param metadata the metadata for the collection
 * @param feeRate the fee rate for the transaction
 * @param content the content for the collection. If provided, it should contain `type` and `body`, where `type` is the MIME type and `body` is the binary data in hex string
 * @param changeAddress the address for the change output
 * @returns the collection info and the PSBTs for the genesis and deploy transactions
 */
export async function deployClosedMinterCollection(
    signer: Signer,
    provider: UtxoProvider & ChainProvider,
    deployInfo: {
        metadata: ClosedMinterCAT721Meta,
        content?: {
            type: ByteString;
            body: ByteString;
        }
    },
    feeRate: number,
    changeAddress?: string
): Promise<CAT721NftInfo<ClosedMinterCAT721Meta> & {
    genesisPsbt: ExtPsbt,
    deployPsbt: ExtPsbt,
    minterUtxo: UTXO
}> {
    const address = await signer.getAddress()
    changeAddress = changeAddress || address

    let utxos = await provider.getUtxos(address)
    utxos = filterFeeUtxos(utxos).slice(0, TX_INPUT_COUNT_MAX)
    checkState(utxos.length > 0, 'Insufficient satoshis')

    const { metadata } = deployInfo

    // Create Genesis contract instance and set metadata in its data field
    const genesis = new Genesis()
    genesis.data = MetadataSerializer.serialize('Collection', deployInfo)

    const genesisPsbt = new ExtPsbt({ network: await provider.getNetwork() })
        .spendUTXO(utxos)
        .addContractOutput(genesis, Postage.GENESIS_POSTAGE)
        .change(changeAddress, feeRate)
        .seal()

    const signedGenesisPsbt = await signer.signPsbt(genesisPsbt.toHex(), genesisPsbt.psbtOptions())
    genesisPsbt.combine(ExtPsbt.fromHex(signedGenesisPsbt))
    genesisPsbt.finalizeAllInputs()

    const genesisUtxo = genesisPsbt.getUtxo(0)!
    const collectionId = `${genesisUtxo.txId}_${genesisUtxo.outputIndex}`
    const cat721ClosedMinter = CAT721ClosedMinterPeripheral.createMinter(collectionId, metadata)
    const minterScriptHash = ContractPeripheral.scriptHash(cat721ClosedMinter)
    const cat721 = new CAT721(minterScriptHash, CAT721GuardPeripheral.getGuardVariantScriptHashes())
    const nftScriptHash = ContractPeripheral.scriptHash(cat721)
    const minterState: CAT721ClosedMinterState = {
        nftScriptHash,
        maxLocalId: metadata.max,
        nextLocalId: 0n,
    }
    cat721ClosedMinter.state = minterState

    // Bind Genesis contract to UTXO
    genesis.bindToUtxo(genesisPsbt.getUtxo(0))

    const deployPsbt = new ExtPsbt({ network: await provider.getNetwork() })
        .addContractInput(genesis, genesisCheckDeploy())
        .spendUTXO(genesisPsbt.getChangeUTXO()!)
        .addContractOutput(cat721ClosedMinter, Postage.MINTER_POSTAGE)
        .change(changeAddress, feeRate)
        .seal()

    const signedDeployPsbt = await signer.signPsbt(deployPsbt.toHex(), deployPsbt.psbtOptions())
    deployPsbt.combine(ExtPsbt.fromHex(signedDeployPsbt))
    deployPsbt.finalizeAllInputs()

    await provider.broadcast(genesisPsbt.extractTransaction().toHex())
    markSpent(provider, genesisPsbt.extractTransaction())
    await provider.broadcast(deployPsbt.extractTransaction().toHex())
    markSpent(provider, deployPsbt.extractTransaction())

    const minterScript = cat721ClosedMinter.lockingScript.toHex()
    let minterUtxo = deployPsbt.getUtxo(0)
    minterUtxo = normalizeUtxoScripts([minterUtxo], minterScript)[0]

    return {
        collectionId: collectionId,
        minterScriptHash,
        collectionScriptHash: nftScriptHash,

        genesisTxid: genesisPsbt.extractTransaction().id,
        deployTxid: deployPsbt.extractTransaction().id,
        metadata,

        genesisPsbt,
        deployPsbt,
        minterUtxo: minterUtxo,
    }
}