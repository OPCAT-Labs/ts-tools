import { ByteString, ChainProvider, ExtPsbt, getBackTraceInfo, PubKey, Signer, UTXO, UtxoProvider, markSpent } from "@opcat-labs/scrypt-ts-opcat";
import { TX_INPUT_COUNT_MAX } from "../../../contracts/constants.js";
import { CAT721 } from "../../../contracts/cat721/cat721.js";
import { CAT721StateLib } from "../../../contracts/cat721/cat721StateLib.js";
import { Postage } from "../../../typeConstants.js";
import { filterFeeUtxos, normalizeUtxoScripts } from "../../../utils/index.js";
import { CAT721GuardPeripheral } from "../../../utils/contractPeripheral.js";
import { CAT721GuardUnlockParams } from "../../../contracts/cat721/cat721GuardUnlock.js";

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
export async function burnNft(
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

    const inputNfts: CAT721[] = inputNftUtxos.map(
        (utxo) => new CAT721(minterScriptHash, guardScriptHashes).bindToUtxo(utxo)
    )
    const burnPsbt = new ExtPsbt({ network: await provider.getNetwork() })

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
    // For burn, outputNftStates is empty since all NFTs are burned
    burnPsbt.addContractInput(guard, 'unlock', {
        inputNftStates,
        outputNftStates: [],
        txInputCountMax,
        txOutputCountMax,
    } as CAT721GuardUnlockParams)

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
        guardTxid: guardPsbt.extractTransaction().id,
        burnTxid: burnPsbt.extractTransaction().id,
    }
}