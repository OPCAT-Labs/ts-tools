import {
  ByteString,
  fill,
  PubKey,
  sha256,
  toByteString,
  toHex,
  ExtPsbt,
  UtxoProvider,
  ChainProvider,
  Signer,
  UTXO,
  markSpent,
  getBackTraceInfo,
} from '@opcat-labs/scrypt-ts-opcat'
import { CAT20 } from '../../../contracts/cat20/cat20'
import { CAT20Guard } from '../../../contracts/cat20/cat20Guard'
import { CAT20StateLib } from '../../../contracts/cat20/cat20StateLib'
import {
  ConstantsLib,
  TX_INPUT_COUNT_MAX,
  TX_OUTPUT_COUNT_MAX,
} from '../../../contracts/constants'
import { Postage, SHA256_EMPTY_STRING } from '../../../typeConstants'
import { applyFixedArray, filterFeeUtxos } from '../../../utils'
import {
  CAT20GuardPeripheral,
  ContractPeripheral,
} from '../../../utils/contractPeripheral'

/**
 * Burn CAT20 tokens in a single transaction.
 * @param signer a signer, such as {@link DefaultSigner} or {@link WalletSigner}
 * @param provider a  {@link UtxoProvider} & {@link ChainProvider}
 * @param minterScriptHash the minter script hash of the CAT20 token
 * @param adminScriptHash the admin script hash of the CAT20 token
 * @param inputTokenUtxos CAT20 token utxos to be sent
 * @param feeRate the fee rate for constructing transactions
 * @returns the guard transaction, the send transaction and the CAT20 token outputs
 */
export async function burn(
  signer: Signer,
  provider: UtxoProvider & ChainProvider,
  minterScriptHash: ByteString,
  adminScriptHash: ByteString,
  inputTokenUtxos: UTXO[],
  feeRate: number
): Promise<{
  guardPsbt: ExtPsbt
  burnPsbt: ExtPsbt
}> {
  const pubkey = await signer.getPublicKey()
  const changeAddress = await signer.getAddress()

  let utxos = await provider.getUtxos(changeAddress)
  utxos = filterFeeUtxos(utxos).slice(0, TX_INPUT_COUNT_MAX)
  if (utxos.length === 0) {
    throw new Error('Insufficient satoshis input amount')
  }

  const inputTokenStates = inputTokenUtxos.map((utxo) =>
    CAT20.deserializeState(utxo.data)
  )
  const { guardState } = CAT20GuardPeripheral.createBurnGuard(
    inputTokenUtxos.map((utxo, index) => ({
      token: utxo,
      inputIndex: index,
    })),
    [
      ...inputTokenStates.map((state) => CAT20StateLib.stateHash(state)),
      ConstantsLib.ZERO_SHA1256_HASH,
      SHA256_EMPTY_STRING,
    ]
  )
  guardState.tokenBurnAmounts[0] = guardState.tokenAmounts[0]

  const guard = new CAT20Guard()
  guard.state = guardState
  const guardScriptHash = ContractPeripheral.scriptHash(guard)

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
    new CAT20(minterScriptHash, adminScriptHash, guardScriptHash).bindToUtxo(
      utxo
    )
  )

  const burnPsbt = new ExtPsbt({ network: await provider.getNetwork() })

  const guardInputIndex = inputTokens.length
  const backtraces = await CAT20GuardPeripheral.getBackTraceInfo(
    minterScriptHash,
    adminScriptHash,
    inputTokenUtxos,
    provider
  )

  // add token inputs
  for (let index = 0; index < inputTokens.length; index++) {
    burnPsbt.addContractInput(inputTokens[index], (contract, tx) => {
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
    })
  }

  // add guard input
  guard.bindToUtxo(guardUtxo)
  burnPsbt.addContractInput(guard, (contract, tx) => {
    const ownerAddrOrScript = fill(toByteString(''), TX_OUTPUT_COUNT_MAX)
    applyFixedArray(
      ownerAddrOrScript,
      tx.txOutputs.map((output) =>
        ContractPeripheral.scriptHash(toHex(output.script))
      )
    )
    const outputTokenAmts = fill(BigInt(0), TX_OUTPUT_COUNT_MAX)
    const tokenScriptIndexArray = fill(-1n, TX_OUTPUT_COUNT_MAX)
    const outputSatoshis = fill(0n, TX_OUTPUT_COUNT_MAX)
    applyFixedArray(
      outputSatoshis,
      tx.txOutputs.map((output) => BigInt(output.value))
    )
    const inputCAT20States = fill(
      CAT20StateLib.create(0n, toByteString('')),
      TX_INPUT_COUNT_MAX
    )
    applyFixedArray(inputCAT20States, inputTokenStates)
    const nextStateHashes = fill(toByteString(''), TX_OUTPUT_COUNT_MAX)
    applyFixedArray(
      nextStateHashes,
      tx.txOutputs.map((output) => sha256(toHex(output.data)))
    )
    contract.unlock(
      nextStateHashes,
      ownerAddrOrScript,
      outputTokenAmts,
      tokenScriptIndexArray,
      outputSatoshis,
      inputCAT20States,
      BigInt(tx.txOutputs.length)
    )
  })

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
  }
}
