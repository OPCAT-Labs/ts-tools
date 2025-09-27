import { ByteString, ChainProvider, ExtPsbt, getBackTraceInfo, PubKey, Signer, toHex, toByteString, UTXO, UtxoProvider, fill, sha256, markSpent } from "@opcat-labs/scrypt-ts-opcat";
import { TX_INPUT_COUNT_MAX, TX_OUTPUT_COUNT_MAX } from "../../../contracts/constants";
import { CAT721 } from "../../../contracts/cat721/cat721";
import { CAT721Guard } from "../../../contracts/cat721/cat721Guard";
import { CAT721StateLib } from "../../../contracts/cat721/cat721StateLib";
import { Postage } from "../../../typeConstants";
import { applyFixedArray, filterFeeUtxos } from "../../../utils";
import { CAT721GuardPeripheral, ContractPeripheral } from "../../../utils/contractPeripheral";

export async function burnNft(
    signer: Signer,
    provider: UtxoProvider & ChainProvider,
    minterScriptHash: ByteString,
    inputNftUtxos: UTXO[],
    feeRate: number
): Promise<{
    guardPsbt: ExtPsbt,
    burnPsbt: ExtPsbt
}> {
    const pubkey = await signer.getPublicKey()
    const changeAddress = await signer.getAddress()

    let utxos = await provider.getUtxos(changeAddress)
    utxos = filterFeeUtxos(utxos).slice(0, TX_INPUT_COUNT_MAX)
    if (utxos.length === 0) {
        throw new Error('Insufficient satoshis input amount')
    }

    const inputNftStates = inputNftUtxos.map((utxo) => CAT721StateLib.deserializeState(utxo.data))
    const { guardState } = CAT721GuardPeripheral.createBurnGuard(
        inputNftUtxos.map((utxo, index) => ({
            nft: utxo,
            inputIndex: index,
        }))
    )
    
    const guard = new CAT721Guard()
    guard.state = guardState
    const guardScriptHash = ContractPeripheral.scriptHash(guard)

    const guardPsbt = new ExtPsbt({network: await provider.getNetwork()})
        .spendUTXO(utxos)
        .addContractOutput(guard, Postage.GUARD_POSTAGE)
        .change(changeAddress, feeRate)
        .seal()
    
    const signedGuardPsbt = await signer.signPsbt(guardPsbt.toHex(), guardPsbt.psbtOptions())
    guardPsbt.combine(ExtPsbt.fromHex(signedGuardPsbt))
    guardPsbt.finalizeAllInputs()

    const guardUtxo = guardPsbt.getUtxo(0)
    const feeUtxo = guardPsbt.getChangeUTXO()

    const inputNfts: CAT721[] = inputNftUtxos.map(
        (utxo) => new CAT721(minterScriptHash, guardScriptHash).bindToUtxo(utxo)
    )
    const burnPsbt = new ExtPsbt({network: await provider.getNetwork()})
    
    const guardInputIndex = inputNfts.length;
    const backtraces = await CAT721GuardPeripheral.getBackTraceInfo(
        minterScriptHash,
        inputNftUtxos,
        provider,
    )

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
        const ownerAddrOrScript = fill(toByteString(''), TX_OUTPUT_COUNT_MAX)
        applyFixedArray(
            ownerAddrOrScript,
            tx.txOutputs.map((output) =>
                ContractPeripheral.scriptHash(toHex(output.script))
            )
        )
        const outputLocalIds = fill(BigInt(-1), TX_OUTPUT_COUNT_MAX)
        const nftScriptHashIndexes = fill(-1n, TX_OUTPUT_COUNT_MAX)
        const outputSatoshis = fill(0n, TX_OUTPUT_COUNT_MAX)
        applyFixedArray(
            outputSatoshis,
            tx.txOutputs.map((output) => BigInt(output.value))
        )
        const inputCAT721States = fill(CAT721StateLib.create(0n, toByteString('')), TX_INPUT_COUNT_MAX)
        applyFixedArray(inputCAT721States, inputNftStates)
        const nextStateHashes = fill(toByteString(''), TX_OUTPUT_COUNT_MAX)
        applyFixedArray(
            nextStateHashes,
            tx.txOutputs.map((output) => sha256(toHex(output.data)))
        )
        contract.unlock(
            nextStateHashes,
            ownerAddrOrScript,
            outputLocalIds,
            nftScriptHashIndexes,
            outputSatoshis,
            inputCAT721States,
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
    provider.addNewUTXO(burnPsbt.getChangeUTXO()!)

    return {
        guardPsbt,
        burnPsbt,
    }
}