import { ChainProvider, ExtPsbt, hexToUint8Array, sha256, Signer, UTXO, UtxoProvider } from "@opcat-labs/scrypt-ts-opcat";
import { CAT721OpenMintInfo } from "../../../contracts/cat721/minters/cat721OpenMintInfo";
import { MetadataSerializer } from "../../../lib/metadata";


export async function createNft(
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
) {
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

    return {
        createNftPsbt: psbt,
        contentUtxo: psbt.getUtxo(0),
        mintInfoUtxo: psbt.getUtxo(1),
    }
    
}