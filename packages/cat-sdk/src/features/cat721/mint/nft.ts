import { addChangeUtxoToProvider, ChainProvider, ExtPsbt, hexToUint8Array, sha256, Signer, UTXO, UtxoProvider } from "@opcat-labs/scrypt-ts-opcat";
import { CAT721OpenMintInfo } from "../../../contracts/cat721/minters/cat721OpenMintInfo.js";
import { MetadataSerializer } from "../../../lib/metadata.js";
import { createFeatureWithDryRun } from "../../../utils/index.js";


export const createNft = createFeatureWithDryRun(async function(
    signer: Signer,
    provider: UtxoProvider & ChainProvider,
    localId: bigint,
    nft: {
        contentType: string
        contentBody: string
        nftmetadata: object
    },
    feeUtxos: UTXO[],
    feeRate: number
): Promise<{
    createNftPsbt: ExtPsbt
    contentUtxo: UTXO
    mintInfoUtxo: UTXO
}> {
    const address = await signer.getAddress()

    const nftStr = MetadataSerializer.serialize(
        'NFT',
        {
            metadata: nft.nftmetadata,
            content: {
                type: nft.contentType,
                body: nft.contentBody,
            }
        }
    )
    const nftStrHash = sha256(nftStr)

    const psbt = new ExtPsbt({network: await provider.getNetwork()})
        .spendUTXO(feeUtxos)
        .addOutput({
            address,
            value: 1n,
            data: hexToUint8Array(nftStr)
        })
        .change(address, feeRate, hexToUint8Array(CAT721OpenMintInfo.serializeState({
            localId,
            contentDataHash: nftStrHash
        })))
        .seal()

    const signedPsbt = await signer.signPsbt(psbt.toHex(), psbt.psbtOptions())
    psbt.combine(ExtPsbt.fromHex(signedPsbt))
    psbt.finalizeAllInputs()
    addChangeUtxoToProvider(provider, psbt)

    return {
        createNftPsbt: psbt,
        contentUtxo: psbt.getUtxo(0),
        mintInfoUtxo: psbt.getUtxo(1),
    }
})