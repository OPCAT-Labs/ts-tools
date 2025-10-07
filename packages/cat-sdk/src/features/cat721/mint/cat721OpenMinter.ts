import { ByteString, ChainProvider, ExtPsbt, getBackTraceInfo, markSpent, PubKey, Script, Sig, Signer, toHex, Transaction, UTXO, UtxoProvider } from "@opcat-labs/scrypt-ts-opcat";
import { CAT721State, MerkleProof, OpenMinterCAT721Meta, ProofNodePos } from "../../../contracts/cat721/types";
import { ConstantsLib } from "../../../contracts/constants";
import { CAT721OpenMinterPeripheral, ContractPeripheral } from "../../../utils/contractPeripheral";
import { createNft } from "./nft";
import { CAT721OpenMintInfo } from "../../../contracts/cat721/minters/cat721OpenMintInfo";
import { Postage } from "../../../typeConstants";
import { CAT721, CAT721Guard } from "../../../contracts";


export async function mintNft(
    signer: Signer,
    provider: UtxoProvider & ChainProvider,
    minterUtxo: UTXO,
    proof: MerkleProof,
    proofNodePos: ProofNodePos,
    nextMerkleRoot: ByteString,
    nft: {
        contentType: string,
        contentBody: string,
        nftmetadata: object
    },
    collectionId: string,
    metadata: OpenMinterCAT721Meta,
    nftReceiver: ByteString,
    changeAddress: string,
    feeRate: number
): Promise<{
    createNftPsbt: ExtPsbt,
    createNftTxId: string,
    mintPsbt: ExtPsbt,
    mintTxId: string,
}> {
    const address = await signer.getAddress()
    let feeUtxos = await provider.getUtxos(address)
    //  fetch minter preTx
    const minterInputIndex = 0;
    const spentMinterTxHex = await provider.getRawTransaction(minterUtxo.txId)
    const spentMinterTx = new Transaction(spentMinterTxHex)
    const minterPreTxHex = await provider.getRawTransaction(
        toHex(spentMinterTx.inputs[minterInputIndex].prevTxId)
    )
    
    const openMinter = CAT721OpenMinterPeripheral.createMinter(collectionId, metadata)
    openMinter.bindToUtxo(minterUtxo)

    const createNftRes = await createNft(
        signer,
        provider,
        openMinter.state.nextLocalId,
        nft,
        feeUtxos,
        feeRate
    );
    const nftState: CAT721State = {
        tag: ConstantsLib.OPCAT_CAT721_TAG,
        localId: openMinter.state.nextLocalId,
        ownerAddr: nftReceiver
    }

    const preminerPubKey = await signer.getPublicKey()
    const backtraceInfo = getBackTraceInfo(
        spentMinterTxHex,
        minterPreTxHex,
        // minter is always the first input
        0
    )
    const nextMinter = openMinter.next({
        ...openMinter.state,
        nextLocalId: openMinter.state.nextLocalId + 1n,
        merkleRoot: nextMerkleRoot,
    })
    const guard = new CAT721Guard()
    const cat721 = new CAT721(ContractPeripheral.scriptHash(openMinter), ContractPeripheral.scriptHash(guard))
    cat721.state = nftState
    const mintPsbt = new ExtPsbt({network: await provider.getNetwork()})
        .addContractInput(openMinter, (contract, tx) => {
            const mintInfo = CAT721OpenMintInfo.deserializeState(createNftRes.mintInfoUtxo.data)
            if (openMinter.state.nextLocalId < openMinter.premine) {
                contract.mint(
                    nftState,
                    mintInfo,
                    proof,
                    proofNodePos,
                    PubKey(preminerPubKey),
                    tx.getSig(0, {publicKey: preminerPubKey}),
                    BigInt(Postage.MINTER_POSTAGE),
                    BigInt(Postage.NFT_POSTAGE),
                    backtraceInfo,
                )
            } else {
                contract.mint(
                    nftState,
                    mintInfo,
                    proof,
                    proofNodePos,
                    '' as PubKey,
                    '' as Sig,
                    BigInt(Postage.MINTER_POSTAGE),
                    BigInt(Postage.NFT_POSTAGE),
                    backtraceInfo,
                )
            }
        })
        .spendUTXO(createNftRes.contentUtxo)
        .spendUTXO(createNftRes.mintInfoUtxo)
        .addContractOutput(nextMinter, Postage.MINTER_POSTAGE)
        .addContractOutput(cat721, Postage.NFT_POSTAGE)
        .change(changeAddress, feeRate)
        .seal()

    const signedMintPsbt = await signer.signPsbt(mintPsbt.toHex(), mintPsbt.psbtOptions())
    mintPsbt.combine(ExtPsbt.fromHex(signedMintPsbt))
    mintPsbt.finalizeAllInputs()

    await provider.broadcast(createNftRes.createNftPsbt.extractTransaction().toHex())
    markSpent(provider, createNftRes.createNftPsbt.extractTransaction())
    await provider.broadcast(mintPsbt.extractTransaction().toHex())
    markSpent(provider, mintPsbt.extractTransaction())

    return {
        createNftPsbt: createNftRes.createNftPsbt,
        createNftTxId: createNftRes.createNftPsbt.extractTransaction().id,
        mintPsbt,
        mintTxId: mintPsbt.extractTransaction().id,
    }
}