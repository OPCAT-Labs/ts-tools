import { ByteString, ChainProvider, ExtPsbt, fill, getBackTraceInfo, markSpent, PubKey, sha256, Sig, Signer, toByteString, toHex, Transaction, UTXO, UtxoProvider } from "@opcat-labs/scrypt-ts-opcat";
import { applyFixedArray, filterFeeUtxos, toTokenOwnerAddress } from "../../../../src/utils";
import { CAT721, CAT721State, CAT721StateLib, TX_INPUT_COUNT_MAX, TX_OUTPUT_COUNT_MAX } from "../../../../src/contracts";
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
    const pubkey = await signer.getPublicKey()

    let utxos = await provider.getUtxos(changeAddress)
    utxos = filterFeeUtxos(utxos).slice(0, TX_INPUT_COUNT_MAX)
    const backtraces = await CAT721GuardPeripheral.getBackTraceInfo(
        minterScriptHash,
        inputNftUtxos,
        provider
    )

    // Calculate transaction input/output counts for send transaction
    // Inputs: nft inputs + guard input + fee input
    const txInputCount = inputNftUtxos.length + 2
    // Outputs: nft outputs + satoshi change output
    const txOutputCount = nftReceivers.length + 1

    const guardOwnerAddr = toTokenOwnerAddress(changeAddress)
    const { guard, guardState, outputNfts: _outputNfts, txInputCountMax, txOutputCountMax } = CAT721GuardPeripheral.createTransferGuard(
        inputNftUtxos.map((utxo, index) => ({
            nft: utxo,
            inputIndex: index,
        })),
        nftReceivers,
        txInputCount,
        txOutputCount,
        guardOwnerAddr
    )
    const inputNfts: CAT721[] = inputNftUtxos.map(
        (utxo, index) => new CAT721(minterScriptHash).bindToUtxo({
            ...utxo,
            txHashPreimage: toHex(new Transaction(backtraces[index].prevTxHex).toTxHashPreimage()),
        })
    )

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
        const nft = new CAT721(minterScriptHash)
        nft.state = outputNft!
        sendPsbt.addContractOutput(nft, Postage.NFT_POSTAGE)
    }
    // add guard input
    sendPsbt.addContractInput(guard, (contract, tx) => {
        const nextStateHashes = fill(toByteString(''), txOutputCountMax)
        applyFixedArray(
            nextStateHashes,
            tx.txOutputs.map(output => sha256(toHex(output.data)))
        )
        const ownerAddrOrScript = fill(toByteString(''), txOutputCountMax)
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
        const outputLocalIds = fill(BigInt(-1), txOutputCountMax)
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
        const outputSatoshis = fill(0n, txOutputCountMax)
        applyFixedArray(
            outputSatoshis,
            tx.txOutputs.map(output => BigInt(output.value))
        )
        const inputCAT721States = fill(CAT721StateLib.create(0n, toByteString('')), txInputCountMax)
        applyFixedArray(inputCAT721States, inputNfts.map(nft => nft.state))
        const nftScriptHashIndexes = fill(-1n, txOutputCountMax)
        applyFixedArray(
            nftScriptHashIndexes,
            outputNfts.map(() => 0n)
        )
        const outputCount = BigInt(tx.txOutputs.length)

        // F14 Fix: Get deployer signature for guard
        const deployerSig = tx.getSig(guardInputIndex, { publicKey: pubkey })

        contract.unlock(
            deployerSig,
            PubKey(pubkey),
            nextStateHashes as any,
            ownerAddrOrScript as any,
            outputLocalIds as any,
            nftScriptHashIndexes as any,
            outputSatoshis as any,
            inputCAT721States as any,
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