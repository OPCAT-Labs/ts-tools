import {
  ByteString,
  fill,
  PubKey,
  sha256,
  Sig,
  toByteString,
  toHex,
  UTXO,
  UtxoProvider,
  ChainProvider,
  Signer,
  ExtPsbt,
  getBackTraceInfo,
} from '@opcat-labs/scrypt-ts-opcat'
import {
  TX_INPUT_COUNT_MAX,
  TX_OUTPUT_COUNT_MAX,
} from '../../contracts/constants'
import {
  applyFixedArray,
  filterFeeUtxos,
} from '../../utils'
import { CAT20Guard } from '../../contracts/cat20/cat20Guard'
import {
  CAT20GuardPeripheral,
  ContractPeripheral,
} from '../../utils/contractPeripheral'
import { Postage, SHA256_EMPTY_STRING } from '../../typeConstants'
import { ConstantsLib } from '../../contracts/constants'
import { CAT20 } from '../../contracts/cat20/cat20'
import { CAT20Incinerator } from '../../contracts/cat20Incinerator'
import { CAT20StateLib } from '../../contracts/cat20/cat20StateLib'

export async function incinerate(
  feeSigner: Signer,
  provider: UtxoProvider & ChainProvider,
  minterScriptHash: ByteString,
  tokenUtxos: UTXO[],
  feeRate: number
): Promise<{
  guardPsbt: ExtPsbt
  burnPsbt: ExtPsbt
}> {
  if (tokenUtxos.length + 3 > TX_INPUT_COUNT_MAX) {
    throw new Error(
      `Too many inputs that exceed the maximum input limit of ${TX_INPUT_COUNT_MAX}`
    )
  }
  const changeAddress = await feeSigner.getAddress()

  const utxos = filterFeeUtxos(await provider.getUtxos(changeAddress)).slice(
    0,
    TX_INPUT_COUNT_MAX
  )
  if (utxos.length === 0) {
    throw new Error('Insufficient satoshis input amount')
  }

  const inputTokenStates = tokenUtxos.map((utxo) =>
    CAT20.deserializeState(utxo.data)
  )

  const guard = new CAT20Guard()
  const guardScriptHash = ContractPeripheral.scriptHash(guard)
  const incinerator = new CAT20Incinerator(guardScriptHash)
  const expectedOwner = ContractPeripheral.scriptHash(incinerator)
  inputTokenStates.forEach((state) => {
    if (state.ownerAddr !== expectedOwner) {
      throw new Error(
        `Invalid token owner, expect ${expectedOwner}, but got ${state.ownerAddr}`
      )
    }
  })

  const { guardState } = CAT20GuardPeripheral.createBurnGuard(
    tokenUtxos.map((utxo, index) => ({
      token: utxo,
      inputIndex: index,
    })),
    [
      ...inputTokenStates.map((state) => CAT20StateLib.stateHash(state)),
      ConstantsLib.ZERO_SHA1256_HASH, // guard input
      SHA256_EMPTY_STRING, // incinerator input
      SHA256_EMPTY_STRING, // fee input
    ]
  )
  guardState.tokenBurnAmounts[0] = guardState.tokenAmounts[0];
  guard.state = guardState

  const guardPsbt = new ExtPsbt({network: await provider.getNetwork()})
    .spendUTXO(utxos)
    .addContractOutput(
      guard,
      Postage.GUARD_POSTAGE,
    )
    .addContractOutput(incinerator, Postage.GUARD_POSTAGE)
    .change(changeAddress, feeRate)
    .seal()

  const signedGuardPsbt = await feeSigner.signPsbt(guardPsbt.toHex(), guardPsbt.psbtOptions())
  guardPsbt.combine(ExtPsbt.fromHex(signedGuardPsbt))

  guardPsbt.finalizeAllInputs()

  const guardUtxo = guardPsbt.getUtxo(0)
  const incineratorUtxo = guardPsbt.getUtxo(1)
  const feeUtxo = guardPsbt.getChangeUTXO()

  const inputTokens: CAT20[] = tokenUtxos.map(
    (utxo) => new CAT20(minterScriptHash, guardScriptHash).bindToUtxo(utxo)
  )

  const burnPsbt = new ExtPsbt({network: await provider.getNetwork()})

  const guardInputIndex = inputTokens.length
  const incineratorInputIndex = inputTokens.length + 1
  const backtraces = await CAT20GuardPeripheral.getBackTraceInfo(
    minterScriptHash,
    tokenUtxos,
    provider
  )

  // add token inputs
  for (let index = 0; index < inputTokens.length; index++) {
    burnPsbt.addContractInput(
      inputTokens[index], 
      (contract) => {
        contract.unlock(
          {
            userPubKey: '' as PubKey,
            userSig: '' as Sig,
            contractInputIndex: BigInt(incineratorInputIndex),
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
      BigInt(tx.txOutputs.length)
    )
  })

  // add incinerator input
  incinerator.bindToUtxo(incineratorUtxo)
  burnPsbt.addContractInput(incinerator, 
    (contract) => {
      contract.incinerate(
        BigInt(guardInputIndex),
        guardState
      )
    }
  )

  // add fee input
  burnPsbt.spendUTXO(feeUtxo!)
  burnPsbt.change(changeAddress, feeRate)
  burnPsbt.seal()

  const signedBurnPsbt = await feeSigner.signPsbt(burnPsbt.toHex(), burnPsbt.psbtOptions())
  burnPsbt.combine(ExtPsbt.fromHex(signedBurnPsbt))
  burnPsbt.finalizeAllInputs()

  // broadcast
  await provider.broadcast(guardPsbt.extractTransaction().toHex())
  await provider.broadcast(burnPsbt.extractTransaction().toHex())
  provider.addNewUTXO(burnPsbt.getChangeUTXO()!)

  return {
    guardPsbt,
    burnPsbt,
  }
}
