import { ByteString, ChainProvider, ExtPsbt, getBackTraceInfo, markSpent, PubKey, Signer, toHex, Transaction, UTXO, UtxoProvider } from "@opcat-labs/scrypt-ts-opcat";
import { CAT721, CAT721Guard, CAT721State, ClosedMinterCAT721Meta, ConstantsLib } from "../../../../src/contracts";
import { CAT721ClosedMinterPeripheral, ContractPeripheral } from "../../../../src/utils/contractPeripheral";
import { createNft } from "../../../../src/features/cat721/mint/nft";
import { Postage } from "../../../../src/typeConstants";



export async function mintNft(
    issuerSigner: Signer,
    feeSigner: Signer,
    provider: UtxoProvider & ChainProvider,
    minterUtxo: UTXO,
    nft: {
        contentType: string,
        contentBody: string,
        nftmetadata: object
    },
    collectionId: string,
    metadata: ClosedMinterCAT721Meta,
    nftReceiver: ByteString,
    changeAddress: string,
    feeUtxos: UTXO[],
    feeRate: number
): Promise<{
    createNftPsbt: ExtPsbt,
    createNftTxId: string,
    mintPsbt: ExtPsbt,
    mintTxId: string,
}> {
    // fetch minter preTx
    const minterInputIndex = 0;
    const spentMinterTxHex = await provider.getRawTransaction(minterUtxo.txId)
    const spentMinterTx = new Transaction(spentMinterTxHex)
    const minterPreTxHex = await provider.getRawTransaction(
        toHex(spentMinterTx.inputs[minterInputIndex].prevTxId)
    )
    const closedMinter = CAT721ClosedMinterPeripheral.createMinter(collectionId, metadata)  
    closedMinter.bindToUtxo(minterUtxo)

    const createNftRes = await createNft(
        feeSigner,
        provider,
        closedMinter.state.nextLocalId,
        nft,
        feeUtxos,
        feeRate
    );
    const nftState: CAT721State = {
        tag: ConstantsLib.OPCAT_CAT721_TAG,
        localId: closedMinter.state.nextLocalId,
        ownerAddr: nftReceiver
    }
    const nextMinter = closedMinter.next({
        ...closedMinter.state,
        nextLocalId: closedMinter.state.nextLocalId + 1n,
    })

    const issuerPubKey = await issuerSigner.getPublicKey()
    const feePubKey = await feeSigner.getPublicKey()
    const backtraceInfo = getBackTraceInfo(
        spentMinterTxHex,
        minterPreTxHex,
        // minter is always the first input
        0
    )
    const guard = new CAT721Guard()
    const cat721 = new CAT721(ContractPeripheral.scriptHash(closedMinter), ContractPeripheral.scriptHash(guard))
    cat721.state = nftState
    const minterPsbt = new ExtPsbt({network: await provider.getNetwork()})
        .addContractInput(closedMinter, (contract, tx) => {
            contract.mint(
                nftState,
                PubKey(issuerPubKey),
                tx.getSig(0, {publicKey: issuerPubKey}),
                BigInt(Postage.MINTER_POSTAGE),
                BigInt(Postage.NFT_POSTAGE),
                backtraceInfo,
            )
        })
        .spendUTXO(createNftRes.contentUtxo)
        .spendUTXO(createNftRes.mintInfoUtxo)
        .addContractOutput(nextMinter, Postage.MINTER_POSTAGE)
        .addContractOutput(cat721, Postage.NFT_POSTAGE)
        .change(changeAddress, feeRate)
        .seal()

    const signedMintPsbt = await issuerSigner.signPsbt(minterPsbt.toHex(), minterPsbt.psbtOptions())
    minterPsbt.combine(ExtPsbt.fromHex(signedMintPsbt))

    if (issuerPubKey != feePubKey) {
        // if issuer and fee signer are different, sign with fee signer
        const signedMintPsbt = await feeSigner.signPsbt(minterPsbt.toHex(), minterPsbt.psbtOptions())
        minterPsbt.combine(ExtPsbt.fromHex(signedMintPsbt))
    }
    minterPsbt.finalizeAllInputs()

    await provider.broadcast(createNftRes.createNftPsbt.extractTransaction().toHex())
    markSpent(provider, createNftRes.createNftPsbt.extractTransaction())
    await provider.broadcast(minterPsbt.extractTransaction().toHex())
    markSpent(provider, minterPsbt.extractTransaction())

    return {
        createNftPsbt: createNftRes.createNftPsbt,
        createNftTxId: createNftRes.createNftPsbt.extractTransaction().id,
        mintPsbt: minterPsbt,
        mintTxId: minterPsbt.extractTransaction().id,
    }
}
