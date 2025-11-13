import {
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
  Transaction,
} from '@opcat-labs/scrypt-ts-opcat'
import { CAT20 } from '../../../contracts/cat20/cat20'
import { CAT20State } from '../../../contracts/cat20/types'
import {
  NULL_ADMIN_SCRIPT_HASH,
  TX_INPUT_COUNT_MAX,
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
import { CAT20Admin } from '../../../contracts/cat20/cat20Admin'
import { SPEND_TYPE_ADMIN_SPEND } from '../../../contracts'

/**
 * Burns CAT20 tokens using admin privileges without requiring owner approval.
 *
 * This function allows the CAT20 admin to forcibly burn (destroy) token UTXOs
 * without obtaining approval from the current token owners. This is a privileged
 * administrative operation that bypasses normal ownership checks.
 *
 * **Admin Authorization:**
 * - The admin uses their private key to authorize the burn operation
 * - Token owners are NOT consulted or required to sign the transaction
 * - This enables emergency token freezing, blacklisting, or regulatory compliance
 *
 * **Use Cases:**
 * - Emergency token freezing for security incidents
 * - Regulatory compliance (e.g., sanctioned addresses)
 * - Token blacklisting or revocation
 * - Recovery from compromised accounts
 *
 * **Technical Flow:**
 * 1. Creates a burn guard transaction to validate the burn operation
 * 2. Burns the specified token UTXOs using admin authorization
 * 3. Returns both the guard transaction and the burn transaction
 *
 * @param signer - A signer instance (e.g., {@link DefaultSigner} or {@link WalletSigner}) controlling the admin
 * @param cat20Admin - The CAT20Admin contract instance {@link CAT20Admin}
 * @param adminUtxo - The UTXO of the admin contract {@link UTXO}
 * @param provider - Combined UTXO and chain provider {@link UtxoProvider} & {@link ChainProvider}
 * @param minterScriptHash - The minter script hash of the CAT20 token
 * @param adminScriptHash - The admin script hash of the CAT20 token
 * @param inputTokenUtxos - Array of CAT20 token UTXOs to be burned (owner approval NOT required)
 * @param feeRate - The fee rate in satoshis per byte for constructing transactions
 *
 * @returns Promise resolving to an object containing:
 *   - `guardPsbt`: The guard transaction PSBT
 *   - `sendPsbt`: The burn transaction PSBT
 *   - `sendTxId`: Transaction ID of the burn transaction
 *   - `guardTxId`: Transaction ID of the guard transaction
 *   - `newCAT20Utxos`: Array of new token UTXOs (empty for burn operation)
 *   - `changeTokenOutputIndex`: Index of change token output (-1 for burn)
 *
 * @throws {Error} If input count exceeds maximum transaction input limit
 * @throws {Error} If insufficient satoshis for transaction fees
 * @throws {Error} If token ownership validation fails (internal check)
 *
 * @example
 * ```typescript
 * // Admin burns tokens from a specific address without owner approval
 * const result = await burnByAdmin(
 *   adminSigner,
 *   cat20AdminContract,
 *   adminUtxo,
 *   provider,
 *   minterScriptHash,
 *   suspiciousTokenUtxos,  // Tokens to burn
 *   1,  // Fee rate
 *   true,  // hasAdmin
 *   adminScriptHash  // Admin script hash
 * );
 * console.log(`Tokens burned in tx: ${result.sendTxId}`);
 * ```
 *
 * @see {@link CAT20Admin} for admin contract details
 * @see {@link burn} for user-initiated token burning with owner approval
 */
export async function burnByAdmin(
  signer: Signer,
  cat20Admin: CAT20Admin,
  adminUtxo: UTXO,
  provider: UtxoProvider & ChainProvider,
  minterScriptHash: string,
  inputTokenUtxos: UTXO[],
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
  const changeTokenOutputIndex = -1
  const { guard, guardState, outputTokens: _outputTokens, txInputCountMax, txOutputCountMax } =
    CAT20GuardPeripheral.createBurnGuard(
      inputTokenUtxos.map((utxo, index) => ({
        token: utxo,
        inputIndex: index,
      }))
    )
  const outputTokens: CAT20State[] = _outputTokens.filter(
    (v) => v != undefined
  ) as CAT20State[]
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
  const feeUtxo = guardPsbt.getChangeUTXO()!
  const guardScriptHashes = CAT20GuardPeripheral.getGuardVariantScriptHashes()
  const inputTokens: CAT20[] = inputTokenUtxos.map((utxo) =>
    new CAT20(
      minterScriptHash,
      guardScriptHashes,
      true,
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

  // Transaction input structure:
  // - Token inputs: [0 to inputTokens.length - 1]
  // - Guard input: inputTokens.length
  // - Admin input: inputTokens.length + 1
  // - Fee input: inputTokens.length + 2 (added later)
  const adminInputIndex = inputTokens.length + 1

  // add token inputs
  for (let index = 0; index < inputTokens.length; index++) {
    sendPsbt.addContractInput(inputTokens[index], (contract) => {
      contract.unlock(
        {
          spendType: SPEND_TYPE_ADMIN_SPEND,
          userPubKey: '' as PubKey,
          userSig: '' as Sig,
          spendScriptInputIndex: BigInt(adminInputIndex),
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

  // add guard input;
  guard.bindToUtxo(guardUtxo)
  sendPsbt.addContractInput(guard, (contract, tx) => {
    const ownerAddrOrScript = fill(toByteString(''), txOutputCountMax)
    applyFixedArray(
      ownerAddrOrScript,
      tx.txOutputs.map((output, index) => {
        return index < outputTokens.length
          ? outputTokens[index].ownerAddr
          : ContractPeripheral.scriptHash(toHex(output.script))
      })
    )
    const outputTokenAmts = fill(BigInt(0), txOutputCountMax)
    applyFixedArray(
      outputTokenAmts,
      outputTokens.map((t) => t.amount)
    )
    const tokenScriptIndexArray = fill(-1n, txOutputCountMax)
    applyFixedArray(
      tokenScriptIndexArray,
      outputTokens.map(() => 0n)
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

  // add admin input
  cat20Admin.bindToUtxo(adminUtxo)
  const pubkey = await signer.getPublicKey()
  const address = await signer.getAddress()
  const spentAdminTxHex = await provider.getRawTransaction(adminUtxo.txId)
  const spentAdminTx = new Transaction(spentAdminTxHex)
  // For backtrace: cat20s adminInput feeInput, so pick the second last input
  let adminBacktraceInputIndex = spentAdminTx.inputs.length - 2
  if (adminBacktraceInputIndex < 0) {
    adminBacktraceInputIndex = 0
  }

  const spentAdminPreTxHex = await provider.getRawTransaction(
    toHex(spentAdminTx.inputs[adminBacktraceInputIndex].prevTxId)
  )
  const backTraceInfo = getBackTraceInfo(
    spentAdminTxHex,
    spentAdminPreTxHex,
    adminBacktraceInputIndex
  )
  sendPsbt.addContractInput(cat20Admin, (contract, tx) => {
    // Use the dynamically calculated adminInputIndex (from line 205)
    const sig = tx.getSig(adminInputIndex, {
      address: address.toString(),
    })
    contract.authorizeToSpendToken(PubKey(pubkey), sig, backTraceInfo)
  })

  sendPsbt.addContractOutput(cat20Admin, adminUtxo.satoshis)

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
