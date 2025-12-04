import { ByteString, ChainProvider, ExtPsbt, fromSupportedNetwork, Script, toHex, Transaction, UTXO, UtxoProvider, markSpent, Signer } from "@opcat-labs/scrypt-ts-opcat";
import { TX_INPUT_COUNT_MAX, CAT721, CAT721StateLib, CAT721State, CAT721UnlockParams, CAT721GuardVariant } from "../../../contracts/index.js";
import { Postage } from "../../../typeConstants.js";
import { filterFeeUtxos, normalizeUtxoScripts } from "../../../utils/index.js";
import { CAT721GuardPeripheral } from "../../../utils/contractPeripheral.js";
import { CAT721GuardUnlockParams } from "../../../contracts/cat721/cat721GuardUnlock.js";


/**
 * Sends a CAT721 NFT using `CAT721Guard` contract
 * @category Feature
 * @param signer the signer for the sender
 * @param provider the provider for the blockchain and UTXO operations
 * @param minterScriptHash the script hash of the minter contract
 * @param inputNftUtxos the UTXOs of the input tokens
 * @param nftReceivers the receivers of the tokens
 * @param feeRate the fee rate for the transaction
 * @returns the PSBTs for the guard and send transactions, the UTXOs of the new tokens
 */
export async function singleSendNft(
    signer: Signer,
    provider: UtxoProvider & ChainProvider,
    minterScriptHash: ByteString,
    inputNftUtxos: UTXO[],
    nftReceivers: ByteString[],
    feeRate: number,
): Promise<{
    guardPsbt: ExtPsbt,
    sendPsbt: ExtPsbt,
    guardTxId: string,
    sendTxId: string,
    newNftUtxos: UTXO[],
}> {
    const pubkey = await signer.getPublicKey()
    const feeChangeAddress = await signer.getAddress()
    const feeUtxos = await provider.getUtxos(feeChangeAddress)

    const guardScriptHashes = CAT721GuardPeripheral.getGuardVariantScriptHashes()
    const cat721 = new CAT721(minterScriptHash, guardScriptHashes)
    const cat721Script = cat721.lockingScript.toHex()
    inputNftUtxos = normalizeUtxoScripts(inputNftUtxos, cat721Script)

    const { guardPsbt, outputNftStates, guard, txInputCountMax, txOutputCountMax } = await singleSendNftStep1(
        provider,
        feeUtxos,
        inputNftUtxos,
        nftReceivers,
        feeChangeAddress,
        feeRate
    )
    const signedGuardPsbt = ExtPsbt.fromHex(await signer.signPsbt(guardPsbt.toHex(), guardPsbt.psbtOptions()))
    guardPsbt.combine(signedGuardPsbt).finalizeAllInputs()
    const { sendPsbt } = await singleSendNftStep2(
        provider,
        minterScriptHash,
        guard,
        guardPsbt,
        inputNftUtxos,
        outputNftStates,
        feeChangeAddress,
        pubkey,
        feeRate,
        undefined,
        txInputCountMax,
        txOutputCountMax
    )
    const signedSendPsbt = ExtPsbt.fromHex(await signer.signPsbt(sendPsbt.toHex(), sendPsbt.psbtOptions()))
    sendPsbt.combine(signedSendPsbt).finalizeAllInputs()
    const { newNftUtxos } = await singleSendNftStep3(
        provider,
        guardPsbt,
        sendPsbt,
        outputNftStates
    )
    return {
        guardPsbt,
        sendPsbt,
        guardTxId: guardPsbt.extractTransaction().id,
        sendTxId: sendPsbt.extractTransaction().id,
        newNftUtxos,
    }
}

/**
 * Helper function for singleSendNft, create the guard psbt but do not sign it
 * @category Feature
 * @param provider the provider for the blockchain and UTXO operations
 * @param feeUtxos the UTXOs for the fee
 * @param inputNftUtxos the UTXOs of the input tokens
 * @param receivers the receivers of the tokens
 * @param feeChangeAddress the address for the change output
 * @param feeRate the fee rate for the transaction
 * @returns the guard and the output token states
 */
export async function singleSendNftStep1(
    provider: UtxoProvider & ChainProvider,
    feeUtxos: UTXO[],
    inputNftUtxos: UTXO[],
    receivers: ByteString[],
    feeChangeAddress: ByteString,
    feeRate: number,
) {
    if (inputNftUtxos.length + 2 > TX_INPUT_COUNT_MAX) {
        throw new Error(
            `Too many inputs that exceed the maximum input limit of ${TX_INPUT_COUNT_MAX}`
        )
    }
    feeUtxos = filterFeeUtxos(feeUtxos).slice(0, TX_INPUT_COUNT_MAX)
    if (feeUtxos.length === 0) {
        throw new Error('Insufficient satoshis input amount')
    }
    receivers = [...receivers]

    // Calculate transaction input/output counts for send transaction
    // Inputs: nft inputs + guard input + fee input
    const txInputCount = inputNftUtxos.length + 2
    // Outputs: nft outputs + satoshi change output
    const txOutputCount = receivers.length + 1

    const { guard, guardState, outputNfts: _outputNfts, txInputCountMax, txOutputCountMax } = CAT721GuardPeripheral.createTransferGuard(
        inputNftUtxos.map((utxo, index) => ({
            nft: utxo,
            inputIndex: index,
        })),
        receivers,
        txInputCount,
        txOutputCount
    )
    const outputNfts: CAT721State[] = _outputNfts.filter((v) => v != undefined) as CAT721State[]
    guard.state = guardState
    const guardPsbt = new ExtPsbt({ network: await provider.getNetwork() })
        .spendUTXO(feeUtxos)
        .addContractOutput(guard, Postage.GUARD_POSTAGE)
        .change(feeChangeAddress, feeRate)
        .seal()
    return { guard, guardPsbt, outputNftStates: outputNfts, txInputCountMax, txOutputCountMax }
}

/**
 * Helper function for singleSendNft, add the nft inputs and outputs to the psbt
 * @category Feature
 * @param provider the provider for the blockchain and UTXO operations
 * @param minterScriptHash the script hash of the minter contract
 * @param guard the guard contract
 * @param finalizedGuardPsbt the finalized guard psbt
 * @param inputNftUtxos the UTXOs of the input tokens
 * @param outputNftStates the output token states
 * @param feeChangeAddress the address for the change output
 * @param publicKey the public key of the sender
 * @param feeRate the fee rate for the transaction
 * @param sendChangeData the change data for the transaction
 * @returns the send psbt
 */
export async function singleSendNftStep2(
    provider: UtxoProvider & ChainProvider,
    minterScriptHash: ByteString,
    guard: CAT721GuardVariant,
    finalizedGuardPsbt: ExtPsbt,
    inputNftUtxos: UTXO[],
    outputNftStates: CAT721State[],
    feeChangeAddress: string,
    publicKey: string,
    feeRate: number,
    sendChangeData: Buffer | undefined,
    txInputCountMax: number,
    txOutputCountMax: number,
) {
    const network = await provider.getNetwork()
    const guardPsbt = finalizedGuardPsbt
    const guardUtxo = guardPsbt.getUtxo(0)
    const feeUtxo = guardPsbt.getChangeUTXO()!

    const guardScriptHashes = CAT721GuardPeripheral.getGuardVariantScriptHashes()
    const backtraces = await CAT721GuardPeripheral.getBackTraceInfo(
        minterScriptHash,
        inputNftUtxos,
        provider
    )
    const inputNfts: CAT721[] = inputNftUtxos.map(
        (_nft, index) => new CAT721(minterScriptHash, guardScriptHashes).bindToUtxo({
            ..._nft,
            txHashPreimage: toHex(new Transaction(backtraces[index].prevTxHex).toTxHashPreimage()),
        })
    )
    const sendPsbt = new ExtPsbt({ network: await provider.getNetwork() })
    const guardInputIndex = inputNfts.length
    const inputNftStates = inputNftUtxos.map((utxo) => CAT721StateLib.deserializeState(utxo.data))
    const guardState = guard.state
    // add nft inputs
    for (let index = 0; index < inputNfts.length; index++) {
        const address = Script.fromHex(inputNftStates[index].ownerAddr).toAddress(fromSupportedNetwork(network))
        sendPsbt.addContractInput(inputNfts[index], 'unlock', {
            guardState,
            guardInputIndex: BigInt(guardInputIndex),
            publicKey,
            address: address.toString(),
            prevTxHex: backtraces[index].prevTxHex,
            prevPrevTxHex: backtraces[index].prevPrevTxHex,
            prevTxInput: backtraces[index].prevTxInput,
        } as CAT721UnlockParams)
    }
    // add nft outputs
    for (const outputNft of outputNftStates) {
        const nft = new CAT721(minterScriptHash, guardScriptHashes)
        nft.state = outputNft
        sendPsbt.addContractOutput(nft, Postage.NFT_POSTAGE)
    }
    // add guard input
    guard.bindToUtxo(guardUtxo)
    sendPsbt.addContractInput(guard, 'unlock', {
        inputNftStates,
        outputNftStates,
        txInputCountMax,
        txOutputCountMax,
    } as CAT721GuardUnlockParams)
    // add fee input
    sendPsbt.spendUTXO(feeUtxo)
    // add change output
    sendPsbt.change(feeChangeAddress, feeRate, sendChangeData || '')
    sendPsbt.seal()
    return { sendPsbt }
}

/**
 * Helper function for singleSendNft, broadcast the transactions and add the new fee UTXO
 * @category Feature
 * @param provider the provider for the blockchain and UTXO operations
 * @param finalizedGuardPsbt the finalized guard psbt
 * @param finalizedSendPsbt the finalized send psbt
 * @param outputNftStates the output token states
 * @returns the new NFT UTXOs and the new fee UTXO
 */
export async function singleSendNftStep3(
    provider: UtxoProvider & ChainProvider,
    finalizedGuardPsbt: ExtPsbt,
    finalizedSendPsbt: ExtPsbt,
    outputNftStates: CAT721State[],
) {
    // broadcast
    await provider.broadcast(finalizedGuardPsbt.extractTransaction().toHex())
    markSpent(provider, finalizedGuardPsbt.extractTransaction())
    await provider.broadcast(finalizedSendPsbt.extractTransaction().toHex())
    markSpent(provider, finalizedSendPsbt.extractTransaction())
    const newFeeUtxo = finalizedSendPsbt.getChangeUTXO()!
    provider.addNewUTXO(newFeeUtxo)

    const newNftUtxos = outputNftStates.map((_, index) => finalizedSendPsbt.getUtxo(index))

    return { newNftUtxos, newFeeUtxo }
}