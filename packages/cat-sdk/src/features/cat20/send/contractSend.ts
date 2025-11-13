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
} from '@opcat-labs/scrypt-ts-opcat'
import { CAT20 } from '../../../contracts/cat20/cat20'
import { CAT20_AMOUNT, CAT20State } from '../../../contracts/cat20/types'
import {
  NULL_ADMIN_SCRIPT_HASH,
  TX_INPUT_COUNT_MAX,
  TX_OUTPUT_COUNT_MAX,
} from '../../../contracts/constants'
import { Postage } from '../../../typeConstants'
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
import { SPEND_TYPE_CONTRACT_SPEND } from '../../../contracts'

/**
 * Send CAT20 tokens to the list of recipients.
 * @param signer a signer, such as {@link DefaultSigner} or {@link WalletSigner}
 * @param provider a  {@link UtxoProvider} & {@link ChainProvider}
 * @param minterScriptHash the minter script hash of the CAT20 token
 * @param adminScriptHash the admin script hash of the CAT20 token
 * @param inputTokenUtxos CAT20 token utxos to be sent
 * @param receivers the recipient's address and token amount
 * @param tokenChangeAddress the address to receive change CAT20 tokens
 * @param feeRate the fee rate for constructing transactions
 * @returns the guard transaction, the send transaction and the CAT20 token outputs
 */
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
  feeRate: number,
  hasAdmin: boolean = false,
  adminScriptHash: string = NULL_ADMIN_SCRIPT_HASH
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

  const txInputCount = inputTokenUtxos.length + 2; // tokens + guard + fee
  const txOutputCount = receivers.length + 1; // receivers + change
  const { guard, guardState, outputTokens: _outputTokens } =
    CAT20GuardPeripheral.createTransferGuard(
      inputTokenUtxos.map((utxo, index) => ({
        token: utxo,
        inputIndex: index,
      })),
      receivers.map((receiver, index) => ({
        ...receiver,
        outputIndex: index,
      })),
      txInputCount,
      txOutputCount
    )
  const outputTokens: CAT20State[] = _outputTokens.filter(
    (v) => v != undefined
  ) as CAT20State[]

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
  const feeUtxo = guardPsbt.getChangeUTXO()!
  const guardScriptHashes = CAT20GuardPeripheral.getGuardVariantScriptHashes()
  const inputTokens: CAT20[] = inputTokenUtxos.map((utxo) =>
    new CAT20(
      minterScriptHash,
      guardScriptHashes,
      hasAdmin,
      adminScriptHash
    ).bindToUtxo(utxo)
  )

  /// we use the fee input as contract input;
  const sendPsbt = new ExtPsbt({ network: await provider.getNetwork() })

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
    sendPsbt.addContractInput(inputTokens[index], (contract, tx) => {
      const contractInputIndexVal = tx.data.inputs.findIndex(
        (_input, inputIndex) =>
          ContractPeripheral.scriptHash(
            toHex(tx.getInputOutput(inputIndex).script) as ByteString
          ) == inputTokenStates[index].ownerAddr
      )
      contract.unlock(
        {
          spendType: SPEND_TYPE_CONTRACT_SPEND,
          userPubKey: '' as PubKey,
          userSig: '' as Sig,
          spendScriptInputIndex: BigInt(contractInputIndexVal),
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
  for (const outputToken of outputTokens) {
    const outputCat20 = new CAT20(
      minterScriptHash,
      guardScriptHashes,
      hasAdmin,
      adminScriptHash
    )
    outputCat20.state = outputToken
    sendPsbt.addContractOutput(outputCat20, Postage.TOKEN_POSTAGE)
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
      nextStateHashes as any,
      ownerAddrOrScript as any,
      outputTokenAmts as any,
      tokenScriptIndexArray as any,
      outputSatoshis as any,
      inputCAT20States as any,
      BigInt(tx.data.outputs.length)
    )
  })

  // add fee input, also is a contract input to unlock cat20
  sendPsbt.spendUTXO(feeUtxo)
  sendPsbt.change(changeAddress, feeRate)
  sendPsbt.seal()

  const signedSendPsbt = await signer.signPsbt(
    sendPsbt.toHex(),
    sendPsbt.psbtOptions()
  )
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
