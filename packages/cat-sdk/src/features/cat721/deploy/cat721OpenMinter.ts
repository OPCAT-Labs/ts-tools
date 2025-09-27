import { ByteString, ChainProvider, ExtPsbt, hexToUint8Array, markSpent, Signer, UtxoProvider } from "@opcat-labs/scrypt-ts-opcat";
import { CAT721OpenMinterState, OpenMinterCAT721Meta } from "../../../contracts/cat721/types";
import { CAT721NftInfo, MetadataSerializer } from "src/lib/metadata";
import { checkState } from "src/utils/check";
import { CAT721 } from "src/contracts/cat721/cat721";
import { CAT721OpenMinter } from "src/contracts/cat721/minters/cat721OpenMinter";
import { CAT721OpenMinterPeripheral, ContractPeripheral } from "src/utils/contractPeripheral";
import { CAT721Guard } from "src/contracts/cat721/cat721Guard";
import { ConstantsLib, TX_INPUT_COUNT_MAX } from "src/contracts/constants";
import { Postage } from "src/typeConstants";
import { filterFeeUtxos } from "src/utils";


export async function deployNft(
    signer: Signer,
    provider: UtxoProvider & ChainProvider,
    metadata: OpenMinterCAT721Meta,
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

    const genesisPsbt = new ExtPsbt({network: await provider.getNetwork()})
        .spendUTXO(utxos)
        .change(changeAddress, feeRate, hexToUint8Array(MetadataSerializer.serialize(
            'Collection',
            {
                metadata,
            }
        )))
        .seal()

    const signedGenesisPsbt = await signer.signPsbt(genesisPsbt.toHex(), genesisPsbt.psbtOptions())
    genesisPsbt.combine(ExtPsbt.fromHex(signedGenesisPsbt))
    genesisPsbt.finalizeAllInputs()


    const collectionId = `${genesisPsbt.getChangeUTXO()!.txId}_${genesisPsbt.getChangeUTXO()!.outputIndex}`
    const cat721OpenMinter = CAT721OpenMinterPeripheral.createMinter(collectionId, metadata)
    const minterScriptHash = ContractPeripheral.scriptHash(cat721OpenMinter)
    const guard = new CAT721Guard()
    const cat721 = new CAT721(minterScriptHash, ContractPeripheral.scriptHash(guard))
    const nftScriptHash = ContractPeripheral.scriptHash(cat721)
    const minterState: CAT721OpenMinterState = {
        tag: ConstantsLib.OPCAT_CAT721_MINTER_TAG,
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