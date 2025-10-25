import {
  ByteString,
  fill,
  PubKey,
  sha256,
  toByteString,
  toHex,
  Signer,
  UtxoProvider,
  ChainProvider,
  UTXO,
  ExtPsbt,
  markSpent,
  fromSupportedNetwork,
  getBackTraceInfo,
  FixedArray,
} from '@opcat-labs/scrypt-ts-opcat'
import { CAT20_AMOUNT, CAT20State } from '../../../contracts/cat20/types'
import {
  ConstantsLib,
  TX_INPUT_COUNT_MAX,
  TX_OUTPUT_COUNT_MAX,
} from '../../../contracts/constants'
import { applyFixedArray, filterFeeUtxos } from '../../../utils'
import {
  CAT20GuardPeripheral,
  ContractPeripheral,
} from '../../../utils/contractPeripheral'
import { Postage, SHA256_EMPTY_STRING } from '../../../typeConstants'
import { CAT20Guard } from '../../../contracts/cat20/cat20Guard'
import { CAT20 } from '../../../contracts/cat20/cat20'
import * as opcat from '@opcat-labs/opcat'
import { CAT20StateLib } from '../../../contracts/cat20/cat20StateLib'
import { Transaction } from '@opcat-labs/opcat'

export async function singleSend(
  signer: Signer,
  provider: UtxoProvider & ChainProvider,
  minterScriptHash: ByteString,
  inputTokenUtxos: UTXO[],
  receivers: Array<{
    address: ByteString
    amount: CAT20_AMOUNT
  }>,
  tokenChangeAddress: ByteString,
  feeRate: number,
  sendChangeData?: Buffer
): Promise<{
  guardPsbt: ExtPsbt
  sendPsbt: ExtPsbt
  sendTxId: string
  guardTxId: string
  newCAT20Utxos: UTXO[]
  changeTokenOutputIndex: number
}> {
  const pubkey = await signer.getPublicKey()
  const feeChangeAddress = await signer.getAddress()
  let feeUtxos = await provider.getUtxos(feeChangeAddress)
  const {
    guardPsbt,
    outputTokenStates,
    changeTokenOutputIndex,
    guard,
    tokenScriptIndexes,
  } = await singleSendStep1(
    provider,
    feeUtxos,
    inputTokenUtxos,
    receivers,
    feeChangeAddress,
    tokenChangeAddress,
    feeRate
  )
  const signedGuardPsbt = ExtPsbt.fromHex(
    await signer.signPsbt(guardPsbt.toHex(), guardPsbt.psbtOptions())
  )
  guardPsbt.combine(signedGuardPsbt).finalizeAllInputs()
  const { sendPsbt } = await singleSendStep2(
    provider,
    minterScriptHash,
    guard,
    tokenScriptIndexes,
    guardPsbt,
    inputTokenUtxos,
    outputTokenStates,
    feeChangeAddress,
    pubkey,
    feeRate,
    sendChangeData
  )
  const signedSendPsbt = ExtPsbt.fromHex(
    await signer.signPsbt(sendPsbt.toHex(), sendPsbt.psbtOptions())
  )
  sendPsbt.combine(signedSendPsbt).finalizeAllInputs()
  const { newCAT20Utxos } = await singleSendStep3(
    provider,
    guardPsbt,
    sendPsbt,
    outputTokenStates
  )
  return {
    guardPsbt,
    sendPsbt,
    guardTxId: guardPsbt.extractTransaction().id,
    sendTxId: sendPsbt.extractTransaction().id,
    newCAT20Utxos,
    changeTokenOutputIndex,
  }
}

export async function singleSendStep1(
  provider: UtxoProvider & ChainProvider,
  feeUtxos: UTXO[],
  inputTokenUtxos: UTXO[],
  receivers: Array<{
    address: ByteString
    amount: CAT20_AMOUNT
  }>,
  feeChangeAddress: ByteString,
  tokenChangeAddress: ByteString,
  feeRate: number
) {
  if (inputTokenUtxos.length + 2 > TX_INPUT_COUNT_MAX) {
    throw new Error(
      `Too many inputs that exceed the maximum input limit of ${TX_INPUT_COUNT_MAX}`
    )
  }

  feeUtxos = filterFeeUtxos(feeUtxos).slice(0, TX_INPUT_COUNT_MAX)

  if (feeUtxos.length === 0) {
    throw new Error('Insufficient satoshis input amount')
  }

  receivers = [...receivers]
  const inputTokenStates = inputTokenUtxos.map((utxo) =>
    CAT20.deserializeState(utxo.data)
  )
  const totalInputAmount = inputTokenStates.reduce(
    (acc, state) => acc + state.amount,
    0n
  )
  const totalOutputAmount = receivers.reduce(
    (acc, receiver) => acc + receiver.amount,
    0n
  )
  let changeTokenOutputIndex = -1
  if (totalInputAmount > totalOutputAmount) {
    changeTokenOutputIndex = receivers.length
    receivers.push({
      address: tokenChangeAddress,
      amount: totalInputAmount - totalOutputAmount,
    })
  }
  const {
    guardState,
    outputTokens: _outputTokens,
    tokenScriptIndexes,
  } = CAT20GuardPeripheral.createTransferGuard(
    inputTokenUtxos.map((utxo, index) => ({
      token: utxo,
      inputIndex: index,
    })),
    receivers.map((receiver, index) => ({
      ...receiver,
      outputIndex: index,
    }))
  )
  const outputTokens: CAT20State[] = _outputTokens.filter(
    (v) => v != undefined
  ) as CAT20State[]
  const guard = new CAT20Guard()
  guard.state = guardState
  const guardPsbt = new ExtPsbt({ network: await provider.getNetwork() })
    .spendUTXO(feeUtxos)
    .addContractOutput(guard, Postage.GUARD_POSTAGE)
    .change(feeChangeAddress, feeRate)
    .seal()

  return {
    guard,
    guardPsbt,
    outputTokenStates: outputTokens,
    changeTokenOutputIndex,
    tokenScriptIndexes,
  }
}

export async function singleSendStep2(
  provider: UtxoProvider & ChainProvider,
  minterScriptHash: ByteString,
  guard: CAT20Guard,
  tokenScriptIndexes: FixedArray<bigint, typeof TX_INPUT_COUNT_MAX>,
  finalizedGuardPsbt: ExtPsbt,
  inputTokenUtxos: UTXO[],
  outputTokenStates: CAT20State[],
  feeChangeAddress: string,
  publicKey: string,
  feeRate: number,
  sendChangeData?: Buffer
) {
  const network = await provider.getNetwork()
  const guardPsbt = finalizedGuardPsbt
  const guardUtxo = guardPsbt.getUtxo(0)
  const feeUtxo = guardPsbt.getChangeUTXO()!

  const guardScriptHash = ContractPeripheral.scriptHash(guard)
  const backtraces = await CAT20GuardPeripheral.getBackTraceInfo(
    minterScriptHash,
    inputTokenUtxos,
    provider
  )
  const inputTokens: CAT20[] = inputTokenUtxos.map((_token, index) =>
    new CAT20(minterScriptHash, guardScriptHash).bindToUtxo({
      ..._token,
      txHashPreimage: toHex(
        new Transaction(backtraces[index].prevTxHex).toTxHashPreimage()
      ),
    })
  )
  const sendPsbt = new ExtPsbt({ network: await provider.getNetwork() })

  const guardInputIndex = inputTokens.length

  const inputTokenStates = inputTokenUtxos.map((utxo) =>
    CAT20.deserializeState(utxo.data)
  )
  const guardState = guard.state
  // add token inputs.
  for (let index = 0; index < inputTokens.length; index++) {
    sendPsbt.addContractInput(inputTokens[index], (cat20, tx) => {
      const address = opcat.Script.fromHex(
        inputTokenStates[index].ownerAddr
      ).toAddress(fromSupportedNetwork(network))
      const sig = tx.getSig(index, {
        address: address.toString(),
      })
      return cat20.unlock(
        {
          userPubKey: PubKey(publicKey),
          userSig: sig,
          contractInputIndex: -1n,
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
  // add token outputs
  for (const outputToken of outputTokenStates) {
    const cat20 = new CAT20(minterScriptHash, guardScriptHash)
    cat20.state = outputToken
    sendPsbt.addContractOutput(cat20, Postage.TOKEN_POSTAGE)
  }

  // add guard input
  guard.bindToUtxo(guardUtxo)
  sendPsbt.addContractInput(guard, (contract, tx) => {
    const ownerAddrOrScript = fill(toByteString(''), TX_OUTPUT_COUNT_MAX)
    applyFixedArray(
      ownerAddrOrScript,
      tx.txOutputs.map((output, index) => {
        return index < outputTokenStates.length
          ? outputTokenStates[index].ownerAddr
          : ContractPeripheral.scriptHash(toHex(output.script))
      })
    )
    const outputTokenAmts = fill(BigInt(0), TX_OUTPUT_COUNT_MAX)
    applyFixedArray(
      outputTokenAmts,
      outputTokenStates.map((t) => t.amount)
    )
    const tokenScriptIndexArray = fill(-1n, TX_OUTPUT_COUNT_MAX)
    applyFixedArray(
      tokenScriptIndexArray,
      outputTokenStates.map(() => 0n)
    )
    const outputSatoshis = fill(0n, TX_OUTPUT_COUNT_MAX)
    applyFixedArray(
      outputSatoshis,
      tx.txOutputs.map((output) => output.value)
    )
    const inputCAT20States = fill(
      CAT20StateLib.create(0n, ''),
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
      tokenScriptIndexes,
      BigInt(tx.txOutputs.length)
    )
  })
  // add fee input
  sendPsbt.spendUTXO(feeUtxo)
  // add change output
  sendPsbt.change(feeChangeAddress, feeRate, sendChangeData || '')

  sendPsbt.seal()

  return { sendPsbt }
}

export async function singleSendStep3(
  provider: UtxoProvider & ChainProvider,
  finalizedGuardPsbt: ExtPsbt,
  finalizedSendPsbt: ExtPsbt,
  outputTokenStates: CAT20State[]
) {
  // broadcast
  await provider.broadcast(finalizedGuardPsbt.extractTransaction().toHex())
  markSpent(provider, finalizedGuardPsbt.extractTransaction())
  await provider.broadcast(finalizedSendPsbt.extractTransaction().toHex())
  markSpent(provider, finalizedSendPsbt.extractTransaction())
  const newFeeUtxo = finalizedSendPsbt.getChangeUTXO()!
  provider.addNewUTXO(newFeeUtxo)

  const newCAT20Utxos = outputTokenStates.map((_, index) =>
    finalizedSendPsbt.getUtxo(index)
  )

  return { newCAT20Utxos, newFeeUtxo }
}
