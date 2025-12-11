import {
  ByteString,
  Signer,
  UtxoProvider,
  ChainProvider,
  UTXO,
  ExtPsbt,
  markSpent,
  fromSupportedNetwork,
  toHex,
} from '@opcat-labs/scrypt-ts-opcat'
import { CAT20_AMOUNT, CAT20State } from '../../../contracts/cat20/types.js'
import {
  NULL_ADMIN_SCRIPT_HASH,
  TX_INPUT_COUNT_MAX,
} from '../../../contracts/constants.js'
import { filterFeeUtxos, normalizeUtxoScripts } from '../../../utils/index.js'
import {
  CAT20GuardPeripheral,
} from '../../../utils/contractPeripheral.js'
import { Postage } from '../../../typeConstants.js'
import { CAT20, CAT20UnlockParams } from '../../../contracts/cat20/cat20.js'
import * as opcat from '@opcat-labs/opcat'
import { Transaction } from '@opcat-labs/opcat'
import { CAT20GuardUnlockParams } from '../../../contracts/cat20/cat20GuardUnlock.js'
import { CAT20GuardVariant } from '../../../contracts/index.js'

/**
 * Sends a CAT20 token using `CAT20Guard` contract
 * @category Feature
 * @param signer the signer for the sender
 * @param provider the provider for the blockchain and UTXO operations
 * @param minterScriptHash the script hash of the minter contract
 * @param inputTokenUtxos the UTXOs of the input tokens
 * @param receivers the receivers of the tokens and the amounts
 * @param tokenChangeAddress the address for the change output
 * @param feeRate the fee rate for the transaction
 * @param hasAdmin whether the token has admin
 * @param adminScriptHash the admin script hash of the CAT20 token
 * @param sendChangeData the change data for the transaction
 * @returns the PSBTs for the guard and send transactions, the UTXOs of the new tokens, and the index of the change token output
 */
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
  hasAdmin: boolean = false,
  adminScriptHash: ByteString = NULL_ADMIN_SCRIPT_HASH,
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
  const feeUtxos = await provider.getUtxos(feeChangeAddress)

  const guardScriptHashes = CAT20GuardPeripheral.getGuardVariantScriptHashes()
  const cat20 = new CAT20(
    minterScriptHash,
    guardScriptHashes,
    hasAdmin,
    adminScriptHash
  )
  const cat20Script = cat20.lockingScript.toHex()
  inputTokenUtxos = normalizeUtxoScripts(inputTokenUtxos, cat20Script)

  const { guardPsbt, outputTokenStates, changeTokenOutputIndex, guard, txInputCountMax, txOutputCountMax } = await singleSendStep1(
    provider,
    feeUtxos,
    inputTokenUtxos,
    receivers,
    feeChangeAddress,
    tokenChangeAddress,
    feeRate
  );
  const signedGuardPsbt = ExtPsbt.fromHex(await signer.signPsbt(guardPsbt.toHex(), guardPsbt.psbtOptions()))
  guardPsbt.combine(signedGuardPsbt).finalizeAllInputs()
  const { sendPsbt } = await singleSendStep2(
    provider,
    minterScriptHash,
    hasAdmin,
    adminScriptHash,
    guard,
    guardPsbt,
    inputTokenUtxos,
    outputTokenStates,
    feeChangeAddress,
    pubkey,
    feeRate,
    sendChangeData,
    txInputCountMax,
    txOutputCountMax
  );
  const signedSendPsbt = ExtPsbt.fromHex(await signer.signPsbt(sendPsbt.toHex(), sendPsbt.psbtOptions()))
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

/**
 * Helper function for singleSend, create the send psbt but do not sign it
 * @category Feature
 * @param provider the provider for the blockchain and UTXO operations
 * @param feeUtxos the UTXOs for the fee
 * @param inputTokenUtxos the UTXOs of the input tokens
 * @param receivers the receivers of the tokens and the amounts
 * @param feeChangeAddress the address for the change output
 * @param tokenChangeAddress the address for the change output
 * @param feeRate the fee rate for the transaction
 * @returns the guard and the output token states
 */
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

  // Calculate transaction input/output counts for send transaction
  // Inputs: token inputs + guard input + fee input
  const txInputCount = inputTokenUtxos.length + 2
  // Outputs: token outputs + satoshi change output
  const txOutputCount = receivers.length + 1

  const { guard, guardState, outputTokens: _outputTokens, txInputCountMax, txOutputCountMax } =
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
    .spendUTXO(feeUtxos)
    .addContractOutput(guard, Postage.GUARD_POSTAGE)
    .change(feeChangeAddress, feeRate)
    .seal()

  return { guard, guardPsbt, outputTokenStates: outputTokens, changeTokenOutputIndex, txInputCountMax, txOutputCountMax }
}

/**
 * Helper function for singleSend, add the token inputs and outputs to the psbt
 * @category Feature
 * @param provider the provider for the blockchain and UTXO operations
 * @param minterScriptHash the script hash of the minter contract
 * @param hasAdmin whether the token has admin
 * @param adminScriptHash the admin script hash
 * @param guard the guard contract
 * @param finalizedGuardPsbt the finalized guard psbt
 * @param inputTokenUtxos the UTXOs of the input tokens
 * @param outputTokenStates the output token states
 * @param feeChangeAddress the address for the change output
 * @param publicKey the public key of the sender
 * @param feeRate the fee rate for the transaction
 * @param sendChangeData the change data for the transaction
 * @returns the send psbt
 */
export async function singleSendStep2(
  provider: UtxoProvider & ChainProvider,
  minterScriptHash: ByteString,
  hasAdmin: boolean,
  adminScriptHash: ByteString,
  guard: CAT20GuardVariant,
  finalizedGuardPsbt: ExtPsbt,
  inputTokenUtxos: UTXO[],
  outputTokenStates: CAT20State[],
  feeChangeAddress: string,
  publicKey: string,
  feeRate: number,
  sendChangeData: Buffer | undefined,
  txInputCountMax: number,
  txOutputCountMax: number
) {

  const network = await provider.getNetwork()
  const guardPsbt = finalizedGuardPsbt
  const guardUtxo = guardPsbt.getUtxo(0)
  const feeUtxo = guardPsbt.getChangeUTXO()!

  const guardScriptHashes = CAT20GuardPeripheral.getGuardVariantScriptHashes()
  const backtraces = await CAT20GuardPeripheral.getBackTraceInfo(
    minterScriptHash,
    inputTokenUtxos,
    provider,
    hasAdmin,
    adminScriptHash
  )
  const inputTokens: CAT20[] = inputTokenUtxos.map((_token, index) =>
    new CAT20(
      minterScriptHash,
      guardScriptHashes,
      hasAdmin,
      adminScriptHash
    ).bindToUtxo({
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
    const address = opcat.Script.fromHex(inputTokenStates[index].ownerAddr).toAddress(fromSupportedNetwork(network))
    sendPsbt.addContractInput(inputTokens[index], 'unlock', {
      guardState,
      guardInputIndex: BigInt(guardInputIndex),
      publicKey,
      address: address.toString(),
      prevTxHex: backtraces[index].prevTxHex,
      prevPrevTxHex: backtraces[index].prevPrevTxHex,
      prevTxInput: backtraces[index].prevTxInput,
    } as CAT20UnlockParams)
  }
  // add token outputs
  for (const outputToken of outputTokenStates) {
    const cat20 = new CAT20(
      minterScriptHash,
      guardScriptHashes,
      hasAdmin,
      adminScriptHash
    )
    cat20.state = outputToken
    sendPsbt.addContractOutput(cat20, Postage.TOKEN_POSTAGE)
  }

  // add guard input
  guard.bindToUtxo(guardUtxo)
  sendPsbt.addContractInput(guard, 'unlock', {
    inputTokenStates,
    outputTokenStates,
    txInputCountMax,
    txOutputCountMax,
  } as CAT20GuardUnlockParams)
  // add fee input
  sendPsbt.spendUTXO(feeUtxo)
  // add change output
  sendPsbt.change(feeChangeAddress, feeRate, sendChangeData || '')

  sendPsbt.seal()

  return { sendPsbt }
}

/**
 * Helper function for singleSend, broadcast the transactions and add the new fee UTXO
 * @category Feature
 * @param provider the provider for the blockchain and UTXO operations
 * @param finalizedGuardPsbt the finalized guard psbt
 * @param finalizedSendPsbt the finalized send psbt
 * @param outputTokenStates the output token states
 * @returns the new CAT20 UTXOs and the new fee UTXO
 */
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


  const newCAT20Utxos = outputTokenStates.map((_, index) => finalizedSendPsbt.getUtxo(index))

  return { newCAT20Utxos, newFeeUtxo }
}
