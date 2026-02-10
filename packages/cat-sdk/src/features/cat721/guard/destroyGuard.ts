import {
    ExtPsbt,
    PubKey,
    Signer,
    UtxoProvider,
    ChainProvider,
    markSpent,
    addChangeUtxoToProvider,
} from '@opcat-labs/scrypt-ts-opcat'
import { TX_INPUT_COUNT_MAX } from '../../../contracts/constants.js'
import { CAT721GuardVariant } from '../../../contracts/index.js'
import { createFeatureWithDryRun, filterFeeUtxos } from '../../../utils/index.js'

/**
 * Destroys CAT721 Guard contracts, returning their satoshis to the owner
 * @category Feature
 * @param signer the signer for the guard owner
 * @param provider the provider for the blockchain and UTXO operations
 * @param guards the Guard contract instances to destroy (must be bound to UTXOs)
 * @param feeRate the fee rate for the transaction
 * @returns the PSBT for the destroy transaction
 */
export const destroyCAT721Guard = createFeatureWithDryRun(async function (
    signer: Signer,
    provider: UtxoProvider & ChainProvider,
    guards: CAT721GuardVariant[],
    feeRate: number
): Promise<{
    destroyPsbt: ExtPsbt
    destroyTxid: string
}> {
    if (guards.length === 0) {
        throw new Error('No guards provided')
    }

    const pubkey = await signer.getPublicKey()
    const changeAddress = await signer.getAddress()

    let utxos = await provider.getUtxos(changeAddress)
    utxos = filterFeeUtxos(utxos).slice(0, TX_INPUT_COUNT_MAX)
    if (utxos.length === 0) {
        throw new Error('Insufficient satoshis input amount')
    }

    const destroyPsbt = new ExtPsbt({ network: await provider.getNetwork() })

    // Add fee UTXO first
    destroyPsbt.spendUTXO(utxos[0])

    // Add guard inputs
    guards.forEach((guard, index) => {
        destroyPsbt.addContractInput(guard, (contract, tx) => {
            (contract as CAT721GuardVariant).destroy(
                tx.getSig(index + 1, { address: changeAddress }),
                PubKey(pubkey)
            )
        })
    })

    destroyPsbt.change(changeAddress, feeRate).seal()

    const signedPsbt = await signer.signPsbt(
        destroyPsbt.toHex(),
        destroyPsbt.psbtOptions()
    )
    destroyPsbt.combine(ExtPsbt.fromHex(signedPsbt))
    destroyPsbt.finalizeAllInputs()

    // Broadcast
    await provider.broadcast(destroyPsbt.extractTransaction().toHex())
    markSpent(provider, destroyPsbt.extractTransaction())
    addChangeUtxoToProvider(provider, destroyPsbt)

    return {
        destroyPsbt,
        destroyTxid: destroyPsbt.extractTransaction().id,
    }
})
