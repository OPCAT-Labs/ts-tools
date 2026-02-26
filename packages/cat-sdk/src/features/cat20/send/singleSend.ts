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
  addChangeUtxoToProvider,
} from '@opcat-labs/scrypt-ts-opcat'
import { CAT20_AMOUNT, CAT20State } from '../../../contracts/cat20/types.js'
import {
  NULL_ADMIN_SCRIPT_HASH,
  TX_INPUT_COUNT_MAX,
  TX_OUTPUT_COUNT_MAX,
} from '../../../contracts/constants.js'
import { applyFixedArray, createFeatureWithDryRun, dryRunFeature, filterFeeUtxos, normalizeUtxoScripts, toTokenOwnerAddress } from '../../../utils/index.js'
import {
  CAT20GuardPeripheral,
  ContractPeripheral,
} from '../../../utils/contractPeripheral.js'
import { Postage, SHA256_EMPTY_STRING } from '../../../typeConstants.js'
import { CAT20 } from '../../../contracts/cat20/cat20.js'
import * as opcat from '@opcat-labs/opcat'
import { CAT20StateLib } from '../../../contracts/cat20/cat20StateLib.js'
import { Transaction } from '@opcat-labs/opcat'
import { SPEND_TYPE_USER_SPEND } from '../../../contracts/index.js'

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
export const singleSend = createFeatureWithDryRun(async function(
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
  let feeUtxos = await provider.getUtxos(feeChangeAddress)

  const cat20 = new CAT20(
    minterScriptHash,
    hasAdmin,
    adminScriptHash
  )
  const cat20Script = cat20.lockingScript.toHex()
  inputTokenUtxos = normalizeUtxoScripts(inputTokenUtxos, cat20Script)

  const { guardPsbt, outputTokenStates, changeTokenOutputIndex, guard, guardState, tokenAmounts, tokenBurnAmounts, txInputCountMax, txOutputCountMax } = await singleSendStep1(
    provider,
    feeUtxos,
    inputTokenUtxos,
    receivers,
    feeChangeAddress,
    tokenChangeAddress,
    feeRate,
    toTokenOwnerAddress(await signer.getAddress()) // deployerAddr
  );
  const signedGuardPsbt = ExtPsbt.fromHex(await signer.signPsbt(guardPsbt.toHex(), guardPsbt.psbtOptions()))
  guardPsbt.combine(signedGuardPsbt).finalizeAllInputs()
  const { sendPsbt } = await singleSendStep2(
    provider,
    minterScriptHash,
    hasAdmin,
    adminScriptHash,
    guard,
    tokenAmounts,
    tokenBurnAmounts,
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
})

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
 * @param guardOwnerAddr the owner address of the guard (used as deployerAddr)
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
  feeRate: number,
  guardOwnerAddr: ByteString,
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

  const { guard, guardState, tokenAmounts, tokenBurnAmounts, outputTokens: _outputTokens, txInputCountMax, txOutputCountMax } =
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
      txOutputCount,
      guardOwnerAddr
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

  return { guard, guardState, tokenAmounts, tokenBurnAmounts, guardPsbt, outputTokenStates: outputTokens, changeTokenOutputIndex, txInputCountMax, txOutputCountMax }
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
  guard: any,
  tokenAmounts: any,
  tokenBurnAmounts: any,
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
    sendPsbt.addContractInput(inputTokens[index], (cat20, tx) => {
      const address = opcat.Script.fromHex(inputTokenStates[index].ownerAddr).toAddress(fromSupportedNetwork(network))
      const sig = tx.getSig(index, {
        address: address.toString()
      })
      return cat20.unlock(
        {
          spendType: SPEND_TYPE_USER_SPEND,
          userPubKey: PubKey(publicKey),
          userSig: sig,
          spendScriptInputIndex: -1n,
        },

        guardState,
        BigInt(guardInputIndex),

        getBackTraceInfo(
          backtraces[index].prevTxHex,
          backtraces[index].prevPrevTxHex,
          backtraces[index].prevTxInput
        )
      )
    },
    )
  }
  // add token outputs
  for (const outputToken of outputTokenStates) {
    const cat20 = new CAT20(
      minterScriptHash,
      hasAdmin,
      adminScriptHash
    )
    cat20.state = outputToken
    sendPsbt.addContractOutput(cat20, Postage.TOKEN_POSTAGE)
  }

  // add guard input
  guard.bindToUtxo(guardUtxo)
  sendPsbt.addContractInput(guard, (contract, tx) => {
    const ownerAddrOrScriptHashes = fill(toByteString(''), txOutputCountMax)
    applyFixedArray(
      ownerAddrOrScriptHashes,
      tx.txOutputs.map((output, index) => {
        return index < outputTokenStates.length
          ? outputTokenStates[index].ownerAddr
          : ContractPeripheral.scriptHash(toHex(output.script))
      })
    )
    const outputTokenAmts = fill(BigInt(0), txOutputCountMax)
    applyFixedArray(
      outputTokenAmts,
      outputTokenStates.map((t) => t.amount)
    )
    const tokenScriptIndexArray = fill(-1n, txOutputCountMax)
    applyFixedArray(
      tokenScriptIndexArray,
      outputTokenStates.map(() => 0n)
    )
    const outputSatoshis = fill(0n, txOutputCountMax)
    applyFixedArray(
      outputSatoshis,
      tx.txOutputs.map((output) => output.value)
    )
    const inputCAT20States = fill(
      CAT20StateLib.create(0n, ''),
      txInputCountMax
    )
    applyFixedArray(inputCAT20States, inputTokenStates)
    const nextStateHashes = fill(toByteString(''), txOutputCountMax)
    applyFixedArray(
      nextStateHashes,
      tx.txOutputs.map((output) => sha256(toHex(output.data)))
    )

    // F14 Fix: Get deployer signature for guard
    const deployerSig = tx.getSig(guardInputIndex, { publicKey })

    contract.unlock(
      deployerSig,
      PubKey(publicKey),
      tokenAmounts as any,
      tokenBurnAmounts as any,
      nextStateHashes as any,
      ownerAddrOrScriptHashes as any,
      outputTokenAmts as any,
      tokenScriptIndexArray as any,
      outputSatoshis as any,
      inputCAT20States as any,
      BigInt(tx.txOutputs.length)
    )
  }
  )
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
  addChangeUtxoToProvider(provider, finalizedSendPsbt)

  const newCAT20Utxos = outputTokenStates.map((_, index) => finalizedSendPsbt.getUtxo(index))

  return { newCAT20Utxos, newFeeUtxo }
}
