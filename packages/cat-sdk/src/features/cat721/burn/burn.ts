import { ByteString, ChainProvider, ExtPsbt, getBackTraceInfo, PubKey, Signer, toHex, toByteString, UTXO, UtxoProvider, fill, sha256, markSpent, addChangeUtxoToProvider, Transaction } from "@opcat-labs/scrypt-ts-opcat";
import { TX_INPUT_COUNT_MAX, TX_OUTPUT_COUNT_MAX } from "../../../contracts/constants.js";
import { CAT721 } from "../../../contracts/cat721/cat721.js";
import { CAT721StateLib } from "../../../contracts/cat721/cat721StateLib.js";
import { Postage } from "../../../typeConstants.js";
import { applyFixedArray, filterFeeUtxos, normalizeUtxoScripts, createFeatureWithDryRun } from "../../../utils/index.js";
import { CAT721GuardPeripheral, ContractPeripheral } from "../../../utils/contractPeripheral.js";

/**
 * Burns a CAT721 NFT using `CAT721Guard` contract
 * @category Feature
 * @param signer the signer for the burner
 * @param provider the provider for the blockchain and UTXO operations
 * @param minterScriptHash the script hash of the minter contract
 * @param inputNftUtxos the UTXOs of the input tokens
 * @param feeRate the fee rate for the transaction
 * @returns the PSBTs for the guard and burn transactions
 */
export const burnNft = createFeatureWithDryRun(async function(
    signer: Signer,
    provider: UtxoProvider & ChainProvider,
    minterScriptHash: ByteString,
    inputNftUtxos: UTXO[],
    feeRate: number
): Promise<{
    guardPsbt: ExtPsbt,
    burnPsbt: ExtPsbt
    guardTxid: string
    burnTxid: string
}> {
    const pubkey = await signer.getPublicKey()
    const changeAddress = await signer.getAddress()

    let utxos = await provider.getUtxos(changeAddress)
    utxos = filterFeeUtxos(utxos).slice(0, TX_INPUT_COUNT_MAX)
    if (utxos.length === 0) {
        throw new Error('Insufficient satoshis input amount')
    }

    const guardScriptHashes = CAT721GuardPeripheral.getGuardVariantScriptHashes()
    const cat721 = new CAT721(minterScriptHash, guardScriptHashes)
    const cat721Script = cat721.lockingScript.toHex()
    inputNftUtxos = normalizeUtxoScripts(inputNftUtxos, cat721Script)

    const inputNftStates = inputNftUtxos.map((utxo) => CAT721StateLib.deserializeState(utxo.data))
    const { guard, guardState, txInputCountMax, txOutputCountMax } = CAT721GuardPeripheral.createBurnGuard(
        inputNftUtxos.map((utxo, index) => ({
            nft: utxo,
            inputIndex: index,
        }))
    )
    guard.state = guardState

    const guardPsbt = new ExtPsbt({ network: await provider.getNetwork() })
        .spendUTXO(utxos)
        .addContractOutput(guard, Postage.GUARD_POSTAGE)
        .change(changeAddress, feeRate)
        .seal()

    const signedGuardPsbt = await signer.signPsbt(guardPsbt.toHex(), guardPsbt.psbtOptions())
    guardPsbt.combine(ExtPsbt.fromHex(signedGuardPsbt))
    guardPsbt.finalizeAllInputs()

    const guardUtxo = guardPsbt.getUtxo(0)
    const feeUtxo = guardPsbt.getChangeUTXO()

    const backtraces = await CAT721GuardPeripheral.getBackTraceInfo(
        minterScriptHash,
        inputNftUtxos,
        provider,
    )
    const inputNfts: CAT721[] = inputNftUtxos.map(
        (utxo, index) => new CAT721(minterScriptHash, guardScriptHashes).bindToUtxo({
            ...utxo,
            txHashPreimage: toHex(
                new Transaction(backtraces[index].prevTxHex).toTxHashPreimage()
            )
        })
    )
    const burnPsbt = new ExtPsbt({ network: await provider.getNetwork() })

    const guardInputIndex = inputNfts.length;
    // add nft inputs
    for (let index = 0; index < inputNfts.length; index++) {
        burnPsbt.addContractInput(
            inputNfts[index],
            (contract, tx) => {
                contract.unlock(
                    {
                        userPubKey: PubKey(pubkey),
                        userSig: tx.getSig(index, { address: changeAddress }),
                        contractInputIndex: BigInt(-1),
                    },
                    guardState,
                    BigInt(guardInputIndex),
                    getBackTraceInfo(
                        backtraces[index].prevTxHex,
                        backtraces[index].prevPrevTxHex,
                        backtraces[index].prevTxInput
                    )
                )
            }
        )
    }

    // add guard input
    guard.bindToUtxo(guardUtxo);
    burnPsbt.addContractInput(guard, (contract, tx) => {
        const ownerAddrOrScript = fill(toByteString(''), txOutputCountMax)
        applyFixedArray(
            ownerAddrOrScript,
            tx.txOutputs.map((output) =>
                ContractPeripheral.scriptHash(toHex(output.script))
            )
        )
        const outputLocalIds = fill(BigInt(-1), txOutputCountMax)
        const nftScriptHashIndexes = fill(-1n, txOutputCountMax)
        const outputSatoshis = fill(0n, txOutputCountMax)
        applyFixedArray(
            outputSatoshis,
            tx.txOutputs.map((output) => BigInt(output.value))
        )
        const inputCAT721States = fill(CAT721StateLib.create(0n, toByteString('')), txInputCountMax)
        applyFixedArray(inputCAT721States, inputNftStates)
        const nextStateHashes = fill(toByteString(''), txOutputCountMax)
        applyFixedArray(
            nextStateHashes,
            tx.txOutputs.map((output) => sha256(toHex(output.data)))
        )
        contract.unlock(
            nextStateHashes as any,
            ownerAddrOrScript as any,
            outputLocalIds as any,
            nftScriptHashIndexes as any,
            outputSatoshis as any,
            inputCAT721States as any,
            BigInt(tx.txOutputs.length)
        )
    })

    // add fee input
    burnPsbt.spendUTXO(feeUtxo!)
    burnPsbt.change(changeAddress, feeRate)
    burnPsbt.seal()

    const signedBurnPsbt = await signer.signPsbt(burnPsbt.toHex(), burnPsbt.psbtOptions())
    burnPsbt.combine(ExtPsbt.fromHex(signedBurnPsbt))
    burnPsbt.finalizeAllInputs()

    // broadcast
    await provider.broadcast(guardPsbt.extractTransaction().toHex())
    markSpent(provider, guardPsbt.extractTransaction())
    await provider.broadcast(burnPsbt.extractTransaction().toHex())
    markSpent(provider, burnPsbt.extractTransaction())
    addChangeUtxoToProvider(provider, burnPsbt)

    return {
        guardPsbt,
        burnPsbt,
        guardTxid: guardPsbt.extractTransaction().id,
        burnTxid: burnPsbt.extractTransaction().id,
    }
})