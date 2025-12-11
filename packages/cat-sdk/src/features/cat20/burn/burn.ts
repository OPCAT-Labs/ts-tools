import {
  ByteString,
  PubKey,
  ExtPsbt,
  UtxoProvider,
  ChainProvider,
  Signer,
  UTXO,
  markSpent,
  getBackTraceInfo,
} from '@opcat-labs/scrypt-ts-opcat'
import { CAT20 } from '../../../contracts/cat20/cat20.js'
import {
  NULL_ADMIN_SCRIPT_HASH,
  TX_INPUT_COUNT_MAX,
} from '../../../contracts/constants.js'
import { Postage } from '../../../typeConstants.js'
import { filterFeeUtxos, normalizeUtxoScripts } from '../../../utils/index.js'
import {
  CAT20GuardPeripheral,
} from '../../../utils/contractPeripheral.js'
import { SPEND_TYPE_USER_SPEND } from '../../../contracts/index.js'
import { CAT20GuardUnlockParams } from '../../../contracts/cat20/cat20GuardUnlock.js'

/**
 * Burns a CAT20 token using `CAT20Guard` contract
 * @category Feature
 * @param signer the signer for the burner
 * @param provider the provider for the blockchain and UTXO operations
 * @param minterScriptHash the script hash of the minter contract
 * @param inputTokenUtxos the UTXOs of the input tokens
 * @param feeRate the fee rate for the transaction
 * @param hasAdmin whether the token has admin
 * @param adminScriptHash the admin script hash of the CAT20 token
 * @returns the PSBTs for the guard and burn transactions
 */
export async function burnToken(
  signer: Signer,
  provider: UtxoProvider & ChainProvider,
  minterScriptHash: ByteString,
  inputTokenUtxos: UTXO[],
  feeRate: number,
  hasAdmin: boolean = false,
  adminScriptHash: ByteString = NULL_ADMIN_SCRIPT_HASH
): Promise<{
  guardPsbt: ExtPsbt
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

  const guardScriptHashes = CAT20GuardPeripheral.getGuardVariantScriptHashes()
  const cat20 = new CAT20(
    minterScriptHash,
    guardScriptHashes,
    hasAdmin,
    adminScriptHash
  )
  const cat20Script = cat20.lockingScript.toHex()
  inputTokenUtxos = normalizeUtxoScripts(inputTokenUtxos, cat20Script)

  const inputTokenStates = inputTokenUtxos.map((utxo) =>
    CAT20.deserializeState(utxo.data)
  )
  const { guard, guardState, txInputCountMax, txOutputCountMax } = CAT20GuardPeripheral.createBurnGuard(
    inputTokenUtxos.map((utxo, index) => ({
      token: utxo,
      inputIndex: index,
    }))
  )
  guardState.tokenBurnAmounts[0] = guardState.tokenAmounts[0]
  guard.state = guardState

  const guardPsbt = new ExtPsbt({ network: await provider.getNetwork() })
    .spendUTXO(utxos)
    .addContractOutput(guard, Postage.GUARD_POSTAGE)
    .change(changeAddress, feeRate)
    .seal()

  const signedGuardPsbt = await signer.signPsbt(
    guardPsbt.toHex(),
    guardPsbt.psbtOptions()
  )
  guardPsbt.combine(ExtPsbt.fromHex(signedGuardPsbt))

  guardPsbt.finalizeAllInputs()

  const guardUtxo = guardPsbt.getUtxo(0)
  const feeUtxo = guardPsbt.getChangeUTXO()

  const inputTokens: CAT20[] = inputTokenUtxos.map((utxo) =>
    new CAT20(
      minterScriptHash,
      guardScriptHashes,
      hasAdmin,
      adminScriptHash
    ).bindToUtxo(utxo)
  )

  const burnPsbt = new ExtPsbt({ network: await provider.getNetwork() })

  const guardInputIndex = inputTokens.length
  const backtraces = await CAT20GuardPeripheral.getBackTraceInfo(
    minterScriptHash,
    inputTokenUtxos,
    provider,
    hasAdmin,
    adminScriptHash
  )

  // add token inputs
  for (let index = 0; index < inputTokens.length; index++) {
    burnPsbt.addContractInput(inputTokens[index], (contract, tx) => {
      contract.unlock(
        {
          spendType: SPEND_TYPE_USER_SPEND,
          userPubKey: PubKey(pubkey),
          userSig: tx.getSig(index, { address: changeAddress }),
          spendScriptInputIndex: BigInt(-1),
        },
        guardState,
        BigInt(guardInputIndex),

        getBackTraceInfo(
          backtraces[index].prevTxHex,
          backtraces[index].prevPrevTxHex,
          backtraces[index].prevTxInput
        )
      )
    })
  }

  // add guard input
  guard.bindToUtxo(guardUtxo)
  // For burn, outputTokenStates is empty since all tokens are burned
  burnPsbt.addContractInput(guard, 'unlock', {
    inputTokenStates,
    outputTokenStates: [],
    txInputCountMax,
    txOutputCountMax,
  } as CAT20GuardUnlockParams)

  // add fee input
  burnPsbt.spendUTXO(feeUtxo!)
  burnPsbt.change(changeAddress, feeRate)
  burnPsbt.seal()

  const signedBurnPsbt = await signer.signPsbt(
    burnPsbt.toHex(),
    burnPsbt.psbtOptions()
  )
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
