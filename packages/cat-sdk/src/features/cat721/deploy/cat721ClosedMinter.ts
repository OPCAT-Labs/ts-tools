
import { ChainProvider, ExtPsbt, hexToUint8Array, markSpent, Signer, UTXO, UtxoProvider } from "@opcat-labs/scrypt-ts-opcat";
import { ClosedMinterCAT721Meta } from "../../../contracts/cat721/types";
import { CAT721NftInfo } from "../../../lib/metadata";
import { filterFeeUtxos } from "../../../utils";
import { checkState } from "../../../utils/check";
import { CAT721ClosedMinterPeripheral, ContractPeripheral, CAT721GuardPeripheral } from "../../../utils/contractPeripheral";
import { ConstantsLib, TX_INPUT_COUNT_MAX } from "../../../contracts/constants";
import { Postage } from "../../../typeConstants";
import { CAT721 } from "../../../contracts/cat721/cat721";
import { CAT721ClosedMinterState } from "../../../contracts/cat721/types";
import { MetadataSerializer } from "../../../lib/metadata";


/**
 * Deploys a CAT721 closed minter and its metadata using `CAT721ClosedMinter` contract
 * Only the token issuer can mint token
 * @category Feature
 * @param signer the signer for the deployer
 * @param provider the provider for the blockchain and UTXO operations
 * @param metadata the metadata for the collection
 * @param feeRate the fee rate for the transaction
 * @param content the content for the collection
 * @param changeAddress the address for the change output
 * @returns the collection info and the PSBTs for the genesis and deploy transactions
 */
export async function deployClosedMinterCollection(
    signer: Signer,
    provider: UtxoProvider & ChainProvider,
    metadata: ClosedMinterCAT721Meta,
    feeRate: number,
    content?: {
        type: string,
        body: string,
    },
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

    const genesisPsbt = new ExtPsbt({ network: await provider.getNetwork() })
        .spendUTXO(utxos)
        .change(changeAddress, feeRate, hexToUint8Array(MetadataSerializer.serialize(
            'Collection',
            {
                metadata,
                content,
            }
        )))
        .seal()

    const signedGenesisPsbt = await signer.signPsbt(genesisPsbt.toHex(), genesisPsbt.psbtOptions())
    genesisPsbt.combine(ExtPsbt.fromHex(signedGenesisPsbt))
    genesisPsbt.finalizeAllInputs()

    const collectionId = `${genesisPsbt.getChangeUTXO()!.txId}_${genesisPsbt.getChangeUTXO()!.outputIndex}`
    const cat721ClosedMinter = CAT721ClosedMinterPeripheral.createMinter(collectionId, metadata)
    const minterScriptHash = ContractPeripheral.scriptHash(cat721ClosedMinter)
    const cat721 = new CAT721(minterScriptHash, CAT721GuardPeripheral.getGuardScriptHashes())
    const nftScriptHash = ContractPeripheral.scriptHash(cat721)
    const minterState: CAT721ClosedMinterState = {
        nftScriptHash,
        maxLocalId: metadata.max,
        nextLocalId: 0n,
    }
    cat721ClosedMinter.state = minterState

    const deployPsbt = new ExtPsbt({ network: await provider.getNetwork() })
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

    return {
        collectionId: collectionId,
        minterScriptHash,
        collectionScriptHash: nftScriptHash,

        genesisTxid: genesisPsbt.extractTransaction().id,
        deployTxid: deployPsbt.extractTransaction().id,
        metadata,

        genesisPsbt,
        deployPsbt,
        minterUtxo: deployPsbt.getUtxo(0),
    }
}