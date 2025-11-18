import { ByteString, ChainProvider, ExtPsbt, hexToUint8Array, markSpent, Signer, UtxoProvider } from "@opcat-labs/scrypt-ts-opcat";
import { CAT721OpenMinterState, OpenMinterCAT721Meta } from "../../../contracts/cat721/types";
import { CAT721NftInfo, MetadataSerializer } from "../../../lib/metadata";
import { checkState } from "../../../utils/check";
import { CAT721 } from "../../../contracts/cat721/cat721";
import { CAT721OpenMinter } from "../../../contracts/cat721/minters/cat721OpenMinter";
import { CAT721OpenMinterPeripheral, ContractPeripheral, CAT721GuardPeripheral } from "../../../utils/contractPeripheral";
import { ConstantsLib, TX_INPUT_COUNT_MAX } from "../../../contracts/constants";
import { Postage } from "../../../typeConstants";
import { filterFeeUtxos } from "../../../utils";


/**
 * Deploys a CAT721 open minter and its metadata using `CAT721OpenMinter` contract
 * @category Feature
 * @param signer the signer for the deployer
 * @param provider the provider for the blockchain and UTXO operations
 * @param metadata the metadata for the collection
 * @param initMerkleRoot the initial merkle root for the collection
 * @param feeRate the fee rate for the transaction
 * @param changeAddress the address for the change output
 * @returns the collection info and the PSBTs for the genesis and deploy transactions
 */
export async function deployOpenMinterCollection(
    signer: Signer,
    provider: UtxoProvider & ChainProvider,
    deployInfo: {
        metadata: OpenMinterCAT721Meta,
        content?: {
            type: ByteString;
            body: ByteString;
        }
    },
    initMerkleRoot: ByteString,
    feeRate: number,
    changeAddress?: string
): Promise<
CAT721NftInfo<OpenMinterCAT721Meta> & {
    genesisPsbt: ExtPsbt,
    deployPsbt: ExtPsbt,
    minter: CAT721OpenMinter
}> {
    const address = await signer.getAddress()
    changeAddress = changeAddress || address

    let utxos = await provider.getUtxos(address)
    utxos = filterFeeUtxos(utxos).slice(0, TX_INPUT_COUNT_MAX)
    checkState(utxos.length > 0, 'Insufficient satoshis')

    const { metadata } = deployInfo

    const genesisPsbt = new ExtPsbt({network: await provider.getNetwork()})
        .spendUTXO(utxos)
        .change(changeAddress, feeRate, hexToUint8Array(MetadataSerializer.serialize(
            'Collection',
            deployInfo
        )))
        .seal()

    const signedGenesisPsbt = await signer.signPsbt(genesisPsbt.toHex(), genesisPsbt.psbtOptions())
    genesisPsbt.combine(ExtPsbt.fromHex(signedGenesisPsbt))
    genesisPsbt.finalizeAllInputs()


    const collectionId = `${genesisPsbt.getChangeUTXO()!.txId}_${genesisPsbt.getChangeUTXO()!.outputIndex}`
    const cat721OpenMinter = CAT721OpenMinterPeripheral.createMinter(collectionId, metadata)
    const minterScriptHash = ContractPeripheral.scriptHash(cat721OpenMinter)
    const cat721 = new CAT721(minterScriptHash, CAT721GuardPeripheral.getGuardVariantScriptHashes())
    const nftScriptHash = ContractPeripheral.scriptHash(cat721)
    const minterState: CAT721OpenMinterState = {
        nftScriptHash,
        merkleRoot: initMerkleRoot,
        nextLocalId: 0n,
    }
    cat721OpenMinter.state = minterState

    const deployPsbt = new ExtPsbt({network: await provider.getNetwork()})
        .spendUTXO(genesisPsbt.getChangeUTXO()!)
        .addContractOutput(cat721OpenMinter, Postage.MINTER_POSTAGE)
        .change(changeAddress, feeRate)
        .seal()

    const signedDeployPsbt = await signer.signPsbt(deployPsbt.toHex(), deployPsbt.psbtOptions())
    deployPsbt.combine(ExtPsbt.fromHex(signedDeployPsbt))
    deployPsbt.finalizeAllInputs()

    await provider.broadcast(genesisPsbt.extractTransaction().toHex())
    markSpent(provider, genesisPsbt.extractTransaction())
    await provider.broadcast(deployPsbt.extractTransaction().toHex())
    markSpent(provider, deployPsbt.extractTransaction())

    return {
        collectionId: collectionId,
        minterScriptHash,
        collectionScriptHash: nftScriptHash,

        genesisTxid: genesisPsbt.extractTransaction().id,
        deployTxid: deployPsbt.extractTransaction().id,
        metadata,

        genesisPsbt,
        deployPsbt,
        minter: cat721OpenMinter,
    }

}