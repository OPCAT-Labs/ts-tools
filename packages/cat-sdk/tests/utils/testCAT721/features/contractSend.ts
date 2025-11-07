import { ByteString, ChainProvider, ExtPsbt, fill, getBackTraceInfo, markSpent, PubKey, sha256, Sig, Signer, toByteString, toHex, Transaction, UTXO, UtxoProvider } from "@opcat-labs/scrypt-ts-opcat";
import { applyFixedArray, filterFeeUtxos } from "../../../../src/utils";
import { CAT721, CAT721Guard, CAT721State, CAT721StateLib, TX_INPUT_COUNT_MAX, TX_OUTPUT_COUNT_MAX } from "../../../../src/contracts";
import { CAT721GuardPeripheral, ContractPeripheral } from "../../../../src/utils/contractPeripheral";
import { Postage } from "../../../../src/typeConstants";



export async function contractSendNft(
    signer: Signer,
    provider: UtxoProvider & ChainProvider,
    minterScriptHash: string,
    inputNftUtxos: UTXO[],
    nftReceivers: ByteString[],
    feeRate: number,
): Promise<{
    guardPsbt: ExtPsbt,
    sendPsbt: ExtPsbt,
    newCAT721Utxos: UTXO[],
}> {
    const changeAddress = await signer.getAddress()

    let utxos = await provider.getUtxos(changeAddress)
    utxos = filterFeeUtxos(utxos).slice(0, TX_INPUT_COUNT_MAX)
    const backtraces = await CAT721GuardPeripheral.getBackTraceInfo(
        minterScriptHash,
        inputNftUtxos,
        provider
    )
    const guard = new CAT721Guard()
    const guardScriptHash = ContractPeripheral.scriptHash(guard)
    const inputNfts: CAT721[] = inputNftUtxos.map(
        (utxo, index) => new CAT721(minterScriptHash, guardScriptHash).bindToUtxo({
            ...utxo,
            txHashPreimage: toHex(new Transaction(backtraces[index].prevTxHex).toTxHashPreimage()),
        })
    )
    const { guardState, outputNfts: _outputNfts } = CAT721GuardPeripheral.createTransferGuard(
        inputNftUtxos.map((utxo, index) => ({
            nft: utxo,
            inputIndex: index,
        })),
        nftReceivers
    )
    guard.state = guardState

    const outputNfts = _outputNfts.filter((v) => v != undefined) as CAT721State[]

    const guardPsbt = new ExtPsbt({ network: await provider.getNetwork() })
        .spendUTXO(utxos)
        .addContractOutput(guard, Postage.GUARD_POSTAGE)
        .change(changeAddress, feeRate)
        .seal()

    const signedGuardPsbt = await signer.signPsbt(guardPsbt.toHex(), guardPsbt.psbtOptions())
    guardPsbt.combine(ExtPsbt.fromHex(signedGuardPsbt))
    guardPsbt.finalizeAllInputs()

    const sendPsbt = new ExtPsbt({ network: await provider.getNetwork() })

    // use fee input as contract input
    const guardInputIndex = inputNftUtxos.length;
    const contractInputIndex = inputNftUtxos.length + 1;

    // add nft inputs
    for (let index = 0; index < inputNfts.length; index++) {
        sendPsbt.addContractInput(inputNfts[index], (contract, tx) => {
            contract.unlock(
                {
                    userPubKey: '' as PubKey,
                    userSig: '' as Sig,
                    contractInputIndex: BigInt(contractInputIndex),
                },
                guardState,
                BigInt(guardInputIndex),
                getBackTraceInfo(backtraces[index].prevTxHex, backtraces[index].prevPrevTxHex, backtraces[index].prevTxInput)
            )
        })
    }
    // add nft outputs
    for (const outputNft of outputNfts) {
        const nft = new CAT721(minterScriptHash, guardScriptHash)
        nft.state = outputNft!
        sendPsbt.addContractOutput(nft, Postage.NFT_POSTAGE)
    }
    // add guard input
    sendPsbt.addContractInput(guard, (contract, tx) => {
        const nextStateHashes = fill(toByteString(''), TX_OUTPUT_COUNT_MAX)
        applyFixedArray(
            nextStateHashes,
            tx.txOutputs.map(output => sha256(toHex(output.data)))
        )
        const ownerAddrOrScript = fill(toByteString(''), TX_OUTPUT_COUNT_MAX)
        applyFixedArray(
            ownerAddrOrScript,
            tx.txOutputs.map((output, outputIndex) => {
                if (outputIndex < outputNfts.length) {
                    return outputNfts[outputIndex]!.ownerAddr
                } else {
                    return ContractPeripheral.scriptHash(toHex(output.script))
                }
            })
        )
        const outputLocalIds = fill(BigInt(-1), TX_OUTPUT_COUNT_MAX)
        applyFixedArray(
            outputLocalIds,
            tx.txOutputs.map((output, outputIndex) => {
                if (outputIndex < outputNfts.length) {
                    return outputNfts[outputIndex]!.localId
                } else {
                    return BigInt(-1)
                }
            })
        )
        const outputSatoshis = fill(0n, TX_OUTPUT_COUNT_MAX)
        applyFixedArray(
            outputSatoshis,
            tx.txOutputs.map(output => BigInt(output.value))
        )
        const inputCAT721States = fill(CAT721StateLib.create(0n, toByteString('')), TX_INPUT_COUNT_MAX)
        applyFixedArray(inputCAT721States, inputNfts.map(nft => nft.state))
        const nftScriptHashIndexes = fill(-1n, TX_OUTPUT_COUNT_MAX)
        applyFixedArray(
            nftScriptHashIndexes,
            outputNfts.map(() => 0n)
        )
        const outputCount = BigInt(tx.txOutputs.length)
        contract.unlock(
            nextStateHashes,
            ownerAddrOrScript,
            outputLocalIds,
            nftScriptHashIndexes,
            outputSatoshis,
            inputCAT721States,
            outputCount
        )
    })
    // add fee input = contract input
    sendPsbt.spendUTXO(guardPsbt.getUtxo(1))
    sendPsbt.change(changeAddress, feeRate)
    sendPsbt.seal()

    const signedSendPsbt = await signer.signPsbt(sendPsbt.toHex(), sendPsbt.psbtOptions())
    sendPsbt.combine(ExtPsbt.fromHex(signedSendPsbt))
    sendPsbt.finalizeAllInputs()

    const newCAT721Utxos = outputNfts.map((_, index) => sendPsbt.getUtxo(index))
    await provider.broadcast(guardPsbt.extractTransaction().toHex())
    markSpent(provider, guardPsbt.extractTransaction())
    await provider.broadcast(sendPsbt.extractTransaction().toHex())
    markSpent(provider, sendPsbt.extractTransaction())
    return {
        guardPsbt,
        sendPsbt,
        newCAT721Utxos,
    }
}