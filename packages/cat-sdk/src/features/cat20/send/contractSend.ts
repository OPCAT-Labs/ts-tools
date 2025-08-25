import {
  ByteString,
  fill,
  PubKey,
  sha256,
  Sig,
  toByteString,
  toHex,
  Signer,
  UtxoProvider,
  ChainProvider,
  UTXO,
  ExtPsbt,
  markSpent,
  getBackTraceInfo,
} from '@opcat-labs/scrypt-ts'
import { CAT20 } from '../../../contracts/cat20/cat20'
import { CAT20Guard } from '../../../contracts/cat20/cat20Guard'
import { CAT20_AMOUNT, CAT20State } from '../../../contracts/cat20/types'
import {
  ConstantsLib,
  TX_INPUT_COUNT_MAX,
  TX_OUTPUT_COUNT_MAX,
} from '../../../contracts/constants'
import { Postage, SHA256_EMPTY_STRING } from '../../../typeConstants'
import {
  applyFixedArray,
  filterFeeUtxos,
  toTokenOwnerAddress,
} from '../../../utils'
import {
  CAT20GuardPeripheral,
  ContractPeripheral,
} from '../../../utils/contractPeripheral'
import { CAT20StateLib } from '../../../contracts/cat20/cat20StateLib'

export async function contractSend(
  signer: Signer,
  provider: UtxoProvider & ChainProvider,
  minterScriptHash: string,
  inputTokenUtxos: UTXO[],
  receivers: Array<{
    address: ByteString
    amount: CAT20_AMOUNT
  }>,
  tokenChangeAddress: ByteString,
  feeRate: number
): Promise<{
  guardPsbt: ExtPsbt
  sendPsbt: ExtPsbt
  sendTxId: string
  guardTxId: string
  newCAT20Utxos: UTXO[]
  changeTokenOutputIndex: number
}> {
  if (inputTokenUtxos.length + 2 > TX_INPUT_COUNT_MAX) {
    throw new Error(
      `Too many inputs that exceed the maximum input limit of ${TX_INPUT_COUNT_MAX}`
    )
  }

  const changeAddress = await signer.getAddress()
  // we use the p2pkh contract as the contract owner
  const expectContractOwner = toTokenOwnerAddress(changeAddress, true)

  let utxos = await provider.getUtxos(changeAddress)
  utxos = filterFeeUtxos(utxos).slice(0, TX_INPUT_COUNT_MAX)

  if (utxos.length === 0) {
    throw new Error('Insufficient satoshis input amount')
  }

  receivers = [...receivers]
  const inputTokenStates = inputTokenUtxos.map((utxo) =>
    CAT20.deserializeState(utxo.data)
  )
  inputTokenStates.map((state, index) => {
    if (state.ownerAddr != expectContractOwner) {
      throw new Error(
        `the ${index} input token owner=${state.ownerAddr} is not ${expectContractOwner}`
      )
    }
  })
  const totalInputAmt = inputTokenStates.reduce(
    (acc, state) => acc + state.amount,
    0n
  )
  const totalOutputAmt = receivers.reduce(
    (acc, receiver) => acc + receiver.amount,
    0n
  )
  let changeTokenOutputIndex = -1
  if (totalInputAmt > totalOutputAmt) {
    changeTokenOutputIndex = receivers.length
    receivers.push({
      address: tokenChangeAddress,
      amount: totalInputAmt - totalOutputAmt,
    })
  }

  const { guardState, outputTokens: _outputTokens } =
    CAT20GuardPeripheral.createTransferGuard(
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
  const guardPsbt = new ExtPsbt({network: await provider.getNetwork()})
    .spendUTXO(utxos)
    .addContractOutput(
      guard,
      Postage.GUARD_POSTAGE,
    )
    .change(changeAddress, feeRate)
    .seal()

  const signedGuardPsbt = await signer.signPsbt(guardPsbt.toHex(), guardPsbt.psbtOptions())
  guardPsbt.combine(ExtPsbt.fromHex(signedGuardPsbt))
  guardPsbt.finalizeAllInputs()

  const guardUtxo = guardPsbt.getUtxo(0)
  const feeUtxo = guardPsbt.getChangeUTXO()!
  const guardScriptHash = ContractPeripheral.scriptHash(guard)
  const inputTokens: CAT20[] = inputTokenUtxos.map(
    (utxo) => new CAT20(minterScriptHash, guardScriptHash).bindToUtxo(utxo)
  )

  /// we use the fee input as contract input;
  const sendPsbt = new ExtPsbt({network: await provider.getNetwork()})

  const guardInputIndex = inputTokens.length
  const backtraces = await CAT20GuardPeripheral.getBackTraceInfo(
    minterScriptHash,
    inputTokenUtxos,
    provider
  )

  // add token inputs
  for (let index = 0; index < inputTokens.length; index++) {
    sendPsbt.addContractInput(inputTokens[index], (contract, tx) => {  
        const contractInputIndexVal = tx.data.inputs.findIndex(
          (input, inputIndex) =>
            ContractPeripheral.scriptHash(
              toHex(tx.getInputOutput(inputIndex).script) as ByteString
            ) == inputTokenStates[index].ownerAddr
        )
        contract.unlock(
          {
            userPubKey: '' as PubKey,
            userSig: '' as Sig,
            contractInputIndex: BigInt(contractInputIndexVal),
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

  // add token outputs
  for (const outputToken of outputTokens) {
    const outputCat20 = new CAT20(minterScriptHash, guardScriptHash)
    outputCat20.state = outputToken
    sendPsbt.addContractOutput(
      outputCat20,
      Postage.TOKEN_POSTAGE,
    )
  }

  // add guard input;
  guard.bindToUtxo(guardUtxo)
  sendPsbt.addContractInput(guard, (contract, tx) => {
      const ownerAddrOrScript = fill(toByteString(''), TX_OUTPUT_COUNT_MAX)
      applyFixedArray(
        ownerAddrOrScript,
        tx.txOutputs.map((output, index) => {
          return index < outputTokens.length
            ? outputTokens[index].ownerAddr
            : ContractPeripheral.scriptHash(toHex(output.script))
        })
      )
      const outputTokenAmts = fill(BigInt(0), TX_OUTPUT_COUNT_MAX)
      applyFixedArray(
        outputTokenAmts,
        outputTokens.map((t) => t.amount)
      )
      const tokenScriptIndexArray = fill(-1n, TX_OUTPUT_COUNT_MAX)
      applyFixedArray(
        tokenScriptIndexArray,
        outputTokens.map(() => 0n)
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
        BigInt(tx.data.outputs.length)
      )
    }
  )

  // add fee input, also is a contract input to unlock cat20
  sendPsbt.spendUTXO(feeUtxo)
  sendPsbt.change(changeAddress, feeRate)
  sendPsbt.seal()

  const signedSendPsbt = await signer.signPsbt(sendPsbt.toHex(), sendPsbt.psbtOptions())
  sendPsbt.combine(ExtPsbt.fromHex(signedSendPsbt))
  sendPsbt.finalizeAllInputs()

  const newCAT20Utxos = outputTokens.map((_, index) => sendPsbt.getUtxo(index))
  const newFeeUtxo = sendPsbt.getChangeUTXO()!

  // broadcast
  await provider.broadcast(guardPsbt.extractTransaction().toHex())
  markSpent(provider, guardPsbt.extractTransaction())
  await provider.broadcast(sendPsbt.extractTransaction().toHex())
  markSpent(provider, sendPsbt.extractTransaction())
  provider.addNewUTXO(newFeeUtxo)

  return {
    sendTxId: sendPsbt.extractTransaction().id,
    guardTxId: guardPsbt.extractTransaction().id,
    guardPsbt,
    sendPsbt,
    newCAT20Utxos,
    changeTokenOutputIndex,
  }
}
