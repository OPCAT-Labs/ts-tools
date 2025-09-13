import {
  ByteString,
  fill,
  FixedArray,
  sha256,
  SmartContract,
  toHex,
  UtxoProvider,
  ChainProvider,
  UTXO,
} from '@opcat-labs/scrypt-ts-opcat'
import { Transaction } from '@opcat-labs/opcat'
import { CAT20 } from '../contracts/cat20/cat20'
import { CAT20Guard } from '../contracts/cat20/cat20Guard'
import { CAT20OpenMinter } from '../contracts/cat20/minters/cat20OpenMinter'
import {
  CAT20_AMOUNT,
  CAT20GuardConstState,
  CAT20OpenMinterState,
  CAT20State,
  OpenMinterCAT20Meta,
} from '../contracts/cat20/types'
import { TX_INPUT_COUNT_MAX, TX_OUTPUT_COUNT_MAX } from '../contracts/constants'
// import { Provider, UTXO } from '../lib/provider'
import { emptyOutputByteStrings, outpoint2ByteString } from '.'
// import { ExtTransaction } from '../lib/extTransaction'
import { CAT20StateLib } from '../contracts/cat20/cat20StateLib'
import { CAT20GuardStateLib } from '../contracts/cat20/cat20GuardStateLib'
import { ConstantsLib } from '../contracts/constants'

export class ContractPeripheral {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static scriptHash(
    contractOrScriptBuffer: SmartContract<any> | Buffer | string
  ) {
    if (contractOrScriptBuffer instanceof SmartContract) {
      return sha256(contractOrScriptBuffer.lockingScript.toHex())
    } else {
      return sha256(toHex(contractOrScriptBuffer))
    }
  }
}

export class CAT20OpenMinterPeripheral {
  static getSplitAmountList(
    preRemainingSupply: CAT20_AMOUNT,
    isPremined: boolean,
    premineAmount: bigint
  ) {
    let nextSupply = preRemainingSupply - 1n
    if (!isPremined && premineAmount > 0n) {
      nextSupply = preRemainingSupply
    }
    const splitAmount = fill(nextSupply / 2n, 2)
    splitAmount[0] += nextSupply - splitAmount[0] * 2n
    return splitAmount
  }

  static createNextMinters(
    contract: CAT20OpenMinter,
    state: CAT20OpenMinterState
  ): {
    nextMinterStates: CAT20OpenMinterState[]
    splitAmountList: FixedArray<CAT20_AMOUNT, 2>
  } {
    const splitAmountList = CAT20OpenMinterPeripheral.getSplitAmountList(
      state.remainingCount,
      state.hasMintedBefore,
      contract.premine
    )

    const nextMinterStates = splitAmountList
      .map((amount) => {
        if (amount > 0n) {
          const newState: CAT20OpenMinterState = {
            tag: ConstantsLib.OPCAT_MINTER_TAG,
            tokenScriptHash: state.tokenScriptHash,
            hasMintedBefore: true,
            remainingCount: amount,
          }
          return newState
        }
        return undefined
      })
      .filter((minter) => minter !== undefined) as CAT20OpenMinterState[]

    return {
      nextMinterStates,
      splitAmountList,
    }
  }

  static createMinter(tokenId: string, metadata: OpenMinterCAT20Meta) {
    const maxCount = metadata.max / metadata.limit
    const premineCount = metadata.premine / metadata.limit
    if (premineCount > 0 && !metadata.preminerAddr) {
      throw new Error('Preminer address is required for premining')
    }

    const contract = new CAT20OpenMinter(
      outpoint2ByteString(tokenId),
      maxCount,
      metadata.premine,
      premineCount,
      metadata.limit,
      metadata.preminerAddr || ''
    )
    contract.checkProps()
    return contract
  }

  static createCAT20Contract(
    minter: CAT20OpenMinter,
    state: CAT20OpenMinterState,
    toAddr: ByteString
  ) {
    let amount = minter.limit
    let receiverAddr = toAddr
    if (!state.hasMintedBefore && minter.premine > 0n) {
      amount = minter.premine
      receiverAddr = minter.preminerAddr
    }
    const guard = new CAT20Guard()
    const adminScriptHash = sha256('')
    const cat20 = new CAT20(
      ContractPeripheral.scriptHash(minter),
      adminScriptHash,
      ContractPeripheral.scriptHash(guard)
    )
    const cat20State: CAT20State = {
      tag: ConstantsLib.OPCAT_CAT20_TAG,
      amount,
      ownerAddr: receiverAddr,
    }
    return [cat20, cat20State] as const
  }
}

export class CAT20GuardPeripheral {
  static createTransferGuard(
    tokenInputs: {
      token: UTXO
      inputIndex: number
    }[],
    receivers: {
      address: ByteString
      amount: CAT20_AMOUNT
      outputIndex: number
    }[]
  ): {
    guardState: CAT20GuardConstState
    outputTokens: FixedArray<CAT20State | undefined, typeof TX_OUTPUT_COUNT_MAX>
  } {
    if (tokenInputs.length === 0) {
      throw new Error('No spent tokens')
    }

    if (tokenInputs.length > TX_INPUT_COUNT_MAX - 1) {
      throw new Error(
        `Too many token inputs that exceed the maximum limit of ${TX_INPUT_COUNT_MAX}`
      )
    }

    const totalTokenInputAmount = tokenInputs.reduce((acc, info) => {
      const state = CAT20.deserializeState(info.token.data)
      return acc + state.amount
    }, 0n)

    const totalTokenOutputAmount = receivers.reduce(
      (acc, receiver) => acc + receiver.amount,
      0n
    )

    if (totalTokenInputAmount !== totalTokenOutputAmount) {
      throw new Error('Unbalanced token output amount')
    }

    const guardState = CAT20GuardStateLib.createEmptyState()

    guardState.tokenScriptHashes[0] = ContractPeripheral.scriptHash(
      tokenInputs[0].token.script
    )
    for (
      let index = 0;
      index < tokenInputs.length && index < TX_INPUT_COUNT_MAX;
      index++
    ) {
      guardState.tokenScriptIndexes[tokenInputs[index].inputIndex] = 0n
    }

    guardState.tokenAmounts[0] = tokenInputs.reduce(
      (p, c) => p + CAT20.deserializeState(c.token.data).amount,
      0n
    )
    const outputTokens = emptyOutputByteStrings().map((_, index) => {
      const receiver = receivers.find((r) => r.outputIndex === index)
      if (receiver) {
        if (receiver.amount <= 0) {
          throw new Error(
            `Invalid token amount ${receiver.amount} for output ${index}`
          )
        }
        return CAT20StateLib.create(receiver.amount, receiver.address)
      } else {
        return undefined
      }
    }) as FixedArray<CAT20State | undefined, typeof TX_OUTPUT_COUNT_MAX>

    return {
      guardState,
      outputTokens,
    }
  }

  static createBurnGuard(
    tokenInputs: {
      token: UTXO
      inputIndex: number
    }[],
    inputStateHashes: ByteString[]
  ): {
    guardState: CAT20GuardConstState
    outputTokens: FixedArray<CAT20State | undefined, typeof TX_OUTPUT_COUNT_MAX>
  } {
    if (tokenInputs.length === 0) {
      throw new Error('No spent tokens')
    }
    if (tokenInputs.length > TX_INPUT_COUNT_MAX - 1) {
      throw new Error(
        `Too many token inputs that exceed the maximum limit of ${TX_INPUT_COUNT_MAX}`
      )
    }
    const guardState = CAT20GuardStateLib.createEmptyState()
    guardState.tokenScriptHashes[0] = ContractPeripheral.scriptHash(
      tokenInputs[0].token.script
    )
    for (
      let index = 0;
      index < tokenInputs.length && index < TX_INPUT_COUNT_MAX;
      index++
    ) {
      guardState.tokenScriptIndexes[tokenInputs[index].inputIndex] = 0n
    }

    guardState.tokenAmounts[0] = tokenInputs.reduce(
      (p, c) => p + CAT20.deserializeState(c.token.data).amount,
      0n
    )
    const outputTokens = fill(undefined, TX_OUTPUT_COUNT_MAX)
    return {
      guardState,
      outputTokens,
    }
  }

  static async getBackTraceInfo(
    minterScrtptHash: string,
    adminScriptHash: string,
    inputTokenUtxos: UTXO[],
    provider: UtxoProvider & ChainProvider
  ) {
    const results: Array<{
      prevTxHex: string
      prevTxInput: number
      prevPrevTxHex: string
    }> = []

    const txCache = new Map<string, string>()
    const getRawTx = async (txId: string): Promise<string> => {
      if (txCache.has(txId)) {
        return txCache.get(txId) as string
      }
      const txHex = await provider.getRawTransaction(txId)
      txCache.set(txId, txHex)
      return txHex
    }
    const expectTokenScriptHash = ContractPeripheral.scriptHash(
      new CAT20(
        minterScrtptHash,
        adminScriptHash,
        ContractPeripheral.scriptHash(new CAT20Guard())
      )
    )

    for (const inputTokenUtxo of inputTokenUtxos) {
      const utxoScriptHash = ContractPeripheral.scriptHash(
        inputTokenUtxo.script
      )
      if (utxoScriptHash !== expectTokenScriptHash) {
        throw new Error(
          `Token utxo ${JSON.stringify(
            inputTokenUtxo
          )} does not match the token script hash ${expectTokenScriptHash}`
        )
      }
      const tokenTxHex = await getRawTx(inputTokenUtxo.txId)
      const tokenTx = new Transaction(tokenTxHex)

      let tokenPrevTxHex: string | undefined
      let tokenTxInputIndex: number | undefined
      for (let idx = 0; idx < tokenTx.inputs.length; idx++) {
        const input = tokenTx.inputs[idx]
        const prevTxId = toHex(input.prevTxId)
        const prevTxHex = await getRawTx(prevTxId)
        const prevTx = new Transaction(prevTxHex)
        const out = prevTx.outputs[input.outputIndex]
        const outScriptHash = ContractPeripheral.scriptHash(out.script.toHex())
        if (
          outScriptHash === minterScrtptHash ||
          outScriptHash === expectTokenScriptHash
        ) {
          tokenPrevTxHex = prevTxHex
          tokenTxInputIndex = idx
          break
        }
      }
      if (tokenPrevTxHex == undefined || tokenTxInputIndex === undefined) {
        throw new Error(
          `Token utxo ${JSON.stringify(inputTokenUtxo)} can not be backtraced`
        )
      }
      results.push({
        prevTxHex: tokenTxHex,
        prevTxInput: tokenTxInputIndex!,
        prevPrevTxHex: tokenPrevTxHex!,
      })
    }
    return results
  }
}
