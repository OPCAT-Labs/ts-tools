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
  toByteString,
  Sha256,
  intToByteString,
  slice,
} from '@opcat-labs/scrypt-ts-opcat'
import { Transaction } from '@opcat-labs/opcat'
import { CAT20 } from '../contracts/cat20/cat20.js'
import { CAT20OpenMinter } from '../contracts/cat20/minters/cat20OpenMinter.js'
import {
  CAT20_AMOUNT,
  CAT20GuardConstState,
  CAT20OpenMinterState,
  CAT20State,
  OpenMinterCAT20Meta,
} from '../contracts/cat20/types.js'
import {
  NULL_ADMIN_SCRIPT_HASH,
  TX_INPUT_COUNT_MAX,
  TX_OUTPUT_COUNT_MAX,
  GUARD_VARIANTS_COUNT,
  NFT_GUARD_VARIANTS_COUNT,
  TX_INPUT_COUNT_MAX_6,
  TX_INPUT_COUNT_MAX_12,
  TX_OUTPUT_COUNT_MAX_6,
  TX_OUTPUT_COUNT_MAX_12,
  GUARD_TOKEN_TYPE_MAX_2,
  NFT_GUARD_COLLECTION_TYPE_MAX_2,
  GUARD_TOKEN_TYPE_MAX,
  NFT_GUARD_COLLECTION_TYPE_MAX
} from '../contracts/constants.js'
// import { Provider, UTXO } from '../lib/provider.js'
import { emptyOutputByteStrings, outpoint2ByteString } from './index.js'
// import { ExtTransaction } from '../lib/extTransaction.js'
import { CAT20StateLib } from '../contracts/cat20/cat20StateLib.js'
import { CAT20GuardStateLib } from '../contracts/cat20/cat20GuardStateLib.js'
import { CAT721GuardConstState, CAT721State, ClosedMinterCAT721Meta, OpenMinterCAT721Meta } from '../contracts/cat721/types.js'
import { CAT721GuardStateLib } from '../contracts/cat721/cat721GuardStateLib.js'
import { CAT721 } from '../contracts/cat721/cat721.js'
import { CAT721OpenMinter } from '../contracts/cat721/minters/cat721OpenMinter.js'
import { CAT721StateLib } from '../contracts/cat721/cat721StateLib.js'
import { CAT721ClosedMinter, CAT20GuardVariant, CAT721GuardVariant } from '../contracts/index.js'
import { CAT20Guard_6_6_2 } from '../contracts/cat20/cat20Guard_6_6_2.js'
import { CAT20Guard_6_6_4 } from '../contracts/cat20/cat20Guard_6_6_4.js'
import { CAT20Guard_12_12_2 } from '../contracts/cat20/cat20Guard_12_12_2.js'
import { CAT20Guard_12_12_4 } from '../contracts/cat20/cat20Guard_12_12_4.js'
import { CAT721Guard_6_6_2 } from '../contracts/cat721/cat721Guard_6_6_2.js'
import { CAT721Guard_6_6_4 } from '../contracts/cat721/cat721Guard_6_6_4.js'
import { CAT721Guard_12_12_2 } from '../contracts/cat721/cat721Guard_12_12_2.js'
import { CAT721Guard_12_12_4 } from '../contracts/cat721/cat721Guard_12_12_4.js'

/**
 * Helper class for contract peripheral operations
 * @category Utils
 */
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

/**
 * Helper class for CAT20 open minter peripheral operations
 * @category Utils
 */
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
    toAddr: ByteString,
    hasAdmin: boolean = false,
    adminScriptHash: ByteString = NULL_ADMIN_SCRIPT_HASH
  ) {
    let amount = minter.limit
    let receiverAddr = toAddr
    if (!state.hasMintedBefore && minter.premine > 0n) {
      amount = minter.premine
      receiverAddr = minter.preminerAddr
    }
    const cat20 = new CAT20(
      ContractPeripheral.scriptHash(minter),
      CAT20GuardPeripheral.getGuardVariantScriptHashes(),
      hasAdmin,
      adminScriptHash
    )
    const cat20State: CAT20State = { amount, ownerAddr: receiverAddr }
    return [cat20, cat20State] as const
  }
}

/**
 * Helper class for CAT20 guard peripheral operations
 * @category Utils
 */
export class CAT20GuardPeripheral {
  static getGuardVariantScriptHashes() {
    const guardVariantScriptHashes: FixedArray<Sha256, typeof GUARD_VARIANTS_COUNT> = fill(
      '' as Sha256,
      GUARD_VARIANTS_COUNT
    )
    guardVariantScriptHashes[0] = ContractPeripheral.scriptHash(new CAT20Guard_6_6_2())
    guardVariantScriptHashes[1] = ContractPeripheral.scriptHash(new CAT20Guard_6_6_4())
    guardVariantScriptHashes[2] = ContractPeripheral.scriptHash(new CAT20Guard_12_12_2())
    guardVariantScriptHashes[3] = ContractPeripheral.scriptHash(new CAT20Guard_12_12_4())
    return guardVariantScriptHashes;
  }

  /**
   * Select appropriate CAT20 guard based on input/output token count and token types
   * @param inputTokenCount - Number of token inputs (excluding guard input)
   * @param outputTokenCount - Number of token outputs
   * @param guardTokenTypes - Number of unique token types
   * @returns guard - The selected guard contract instance
   * @returns txInputCountMax - Maximum input count for the selected guard
   * @returns txOutputCountMax - Maximum output count for the selected guard
   */
  private static selectCAT20Guard(
    txInputCount: number,
    txOutputCount: number,
    guardTokenTypes: number
  ): {
    guard: CAT20GuardVariant
    txInputCountMax: typeof TX_INPUT_COUNT_MAX_6 | typeof TX_INPUT_COUNT_MAX_12
    txOutputCountMax: typeof TX_OUTPUT_COUNT_MAX_6 | typeof TX_OUTPUT_COUNT_MAX_12
  } {
    
    if (txInputCount > TX_INPUT_COUNT_MAX) {
      throw new Error(`Too many transaction inputs that exceed the maximum limit of ${TX_INPUT_COUNT_MAX}`)
    }
    if (txOutputCount > TX_OUTPUT_COUNT_MAX) {
      throw new Error(`Too many transaction outputs that exceed the maximum limit of ${TX_OUTPUT_COUNT_MAX}`)
    }

    let guard: CAT20GuardVariant
    let txInputCountMax: typeof TX_INPUT_COUNT_MAX_6 | typeof TX_INPUT_COUNT_MAX_12
    let txOutputCountMax: typeof TX_OUTPUT_COUNT_MAX_6 | typeof TX_OUTPUT_COUNT_MAX_12

    if (txInputCount <= TX_INPUT_COUNT_MAX_6 && txOutputCount <= TX_OUTPUT_COUNT_MAX_6) {
      txInputCountMax = TX_INPUT_COUNT_MAX_6
      txOutputCountMax = TX_OUTPUT_COUNT_MAX_6
      if (guardTokenTypes <= GUARD_TOKEN_TYPE_MAX_2) {
        guard = new CAT20Guard_6_6_2()
      } else {
        guard = new CAT20Guard_6_6_4()
      }
    } else {
      txInputCountMax = TX_INPUT_COUNT_MAX_12
      txOutputCountMax = TX_OUTPUT_COUNT_MAX_12
      if (guardTokenTypes <= GUARD_TOKEN_TYPE_MAX_2) {
        guard = new CAT20Guard_12_12_2()
      } else {
        guard = new CAT20Guard_12_12_4()
      }
    }

    return { guard, txInputCountMax, txOutputCountMax }
  }

  /**
   * Process token inputs and extract token amounts, script hashes mapping
   * @returns tokenAmounts - Map of token type index to total amount
   * @returns tokenScriptHashes - Map of token type index to script hash
   * @returns scriptHashToIndex - Map of script hash to token type index (derived from tokenScriptHashes.size)
   */
  private static processTokenInputs(
    tokenInputs: { token: UTXO; inputIndex: number }[],
    initialTokenScriptIndexes: ByteString
  ): {
    tokenAmounts: Map<number, bigint>
    tokenScriptHashes: Map<number, string>
    tokenScriptIndexes: ByteString,
    guardTokenTypes: number
  } {
    const scriptHashToIndex = new Map<string, number>()
    const tokenAmounts = new Map<number, bigint>()
    const tokenScriptHashes = new Map<number, string>()

    // Map each unique token script hash to an index
    for (const input of tokenInputs) {
      const scriptHash = ContractPeripheral.scriptHash(input.token.script)
      if (!scriptHashToIndex.has(scriptHash)) {
        const index = scriptHashToIndex.size
        scriptHashToIndex.set(scriptHash, index)
        tokenScriptHashes.set(index, scriptHash)
        tokenAmounts.set(index, 0n)
      }
      const typeIndex = scriptHashToIndex.get(scriptHash)!
      const currentAmount = tokenAmounts.get(typeIndex)!
      tokenAmounts.set(
        typeIndex,
        currentAmount + CAT20.deserializeState(input.token.data).amount
      )
    }

    // Build tokenScriptIndexes by modifying individual bytes
    let tokenScriptIndexes = initialTokenScriptIndexes
    for (
      let index = 0;
      index < tokenInputs.length && index < TX_INPUT_COUNT_MAX;
      index++
    ) {
      const inputIndex = tokenInputs[index].inputIndex
      const scriptHash = ContractPeripheral.scriptHash(
        tokenInputs[index].token.script
      )
      const typeIndex = scriptHashToIndex.get(scriptHash)!
      const before = slice(tokenScriptIndexes, 0n, BigInt(inputIndex))
      const after = slice(tokenScriptIndexes, BigInt(inputIndex + 1))
      tokenScriptIndexes =
        before + intToByteString(BigInt(typeIndex), 1n) + after
    }

    const guardTokenTypes = tokenScriptHashes.size;
    if (guardTokenTypes > GUARD_TOKEN_TYPE_MAX) {
      throw new Error(`Too many token types that exceed the maximum limit of ${GUARD_TOKEN_TYPE_MAX}`)
    }

    return {
      tokenAmounts,
      tokenScriptHashes,
      tokenScriptIndexes,
      guardTokenTypes,
    }
  }
  static createTransferGuard(
    tokenInputs: {
      token: UTXO
      inputIndex: number
    }[],
    receivers: {
      address: ByteString
      amount: CAT20_AMOUNT
      outputIndex: number
    }[],
    txInputCount: number,
    txOutputCount: number,
    deployerAddr: ByteString,
  ): {
    guard: CAT20GuardVariant
    guardState: CAT20GuardConstState
    outputTokens: FixedArray<CAT20State | undefined, typeof TX_OUTPUT_COUNT_MAX>
    txInputCountMax: typeof TX_INPUT_COUNT_MAX_6 | typeof TX_INPUT_COUNT_MAX_12
    txOutputCountMax: typeof TX_OUTPUT_COUNT_MAX_6 | typeof TX_OUTPUT_COUNT_MAX_12
  } {
    if (txInputCount > TX_INPUT_COUNT_MAX) {
      throw new Error(`Too many transaction inputs that exceed the maximum limit of ${TX_INPUT_COUNT_MAX}`)
    }
    if (txOutputCount > TX_OUTPUT_COUNT_MAX) {
      throw new Error(`Too many transaction outputs that exceed the maximum limit of ${TX_OUTPUT_COUNT_MAX}`)
    }
    if (tokenInputs.length + 1 > TX_INPUT_COUNT_MAX) {
      throw new Error(`Too many token inputs that exceed the maximum limit of ${TX_INPUT_COUNT_MAX - 1}`)
    }
    if (receivers.length > TX_OUTPUT_COUNT_MAX) { 
      throw new Error(`Too many token outputs that exceed the maximum limit of ${TX_OUTPUT_COUNT_MAX}`)
    }
    if (tokenInputs.length === 0) {
      throw new Error('No spent tokens')
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

    // Determine which size guard to use based on input count
    const txInputCountMax = txInputCount <= TX_INPUT_COUNT_MAX_6 ? TX_INPUT_COUNT_MAX_6 : TX_INPUT_COUNT_MAX_12

    // Create guard state based on the selected guard size
    const guardState = CAT20GuardStateLib.createEmptyState(txInputCountMax)
    guardState.deployerAddr = deployerAddr

    // Process token inputs to get token amounts and script hash mapping
    const { tokenAmounts, tokenScriptHashes, tokenScriptIndexes, guardTokenTypes } = this.processTokenInputs(
      tokenInputs,
      guardState.tokenScriptIndexes
    )

    // Set the processed data to guardState
    tokenScriptHashes.forEach((scriptHash, index) => {
      guardState.tokenScriptHashes[index] = scriptHash
    })
    tokenAmounts.forEach((amount, index) => {
      guardState.tokenAmounts[index] = amount
    })
    guardState.tokenScriptIndexes = tokenScriptIndexes

    // Auto-detect guardTokenTypes and select final guard
    const { guard, txInputCountMax: finalTxInputCountMax, txOutputCountMax } = this.selectCAT20Guard(
      txInputCount,
      txOutputCount,
      guardTokenTypes
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
      guard,
      guardState,
      outputTokens,
      txInputCountMax: finalTxInputCountMax,
      txOutputCountMax,
    }
  }

  static createBurnGuard(
    tokenInputs: {
      token: UTXO
      inputIndex: number
    }[],
    deployerAddr: ByteString,
  ): {
    guard: CAT20GuardVariant
    guardState: CAT20GuardConstState
    outputTokens: FixedArray<CAT20State | undefined, typeof TX_OUTPUT_COUNT_MAX>
    txInputCountMax: typeof TX_INPUT_COUNT_MAX_6 | typeof TX_INPUT_COUNT_MAX_12
    txOutputCountMax: typeof TX_OUTPUT_COUNT_MAX_6 | typeof TX_OUTPUT_COUNT_MAX_12
  } {
    if (tokenInputs.length === 0) {
      throw new Error('No spent tokens')
    }

    // Validate counts first
    const inputTokenCount = tokenInputs.length
    const outputTokenCount = 0 // No token outputs for burn

    // Validate input token count
    if (inputTokenCount > TX_INPUT_COUNT_MAX - 1) {
      throw new Error(
        `Too many token inputs that exceed the maximum limit of ${TX_INPUT_COUNT_MAX - 1}`
      )
    }

    // Determine which size guard to use based on input count
    const txInputCountMax = (inputTokenCount + 1) <= TX_INPUT_COUNT_MAX_6 ? TX_INPUT_COUNT_MAX_6 : TX_INPUT_COUNT_MAX_12

    // Create guard state based on the selected guard size
    const guardState = CAT20GuardStateLib.createEmptyState(txInputCountMax)
    guardState.deployerAddr = deployerAddr

    // Process token inputs to get token amounts and script hash mapping
    const { tokenAmounts, tokenScriptHashes, tokenScriptIndexes } = this.processTokenInputs(
      tokenInputs,
      guardState.tokenScriptIndexes
    )

    // Set the processed data to guardState
    tokenScriptHashes.forEach((scriptHash, index) => {
      guardState.tokenScriptHashes[index] = scriptHash
    })
    tokenAmounts.forEach((amount, index) => {
      guardState.tokenAmounts[index] = amount
    })
    guardState.tokenScriptIndexes = tokenScriptIndexes

    // Auto-detect guardTokenTypes and select final guard
    const guardTokenTypes = tokenScriptHashes.size
    // For burn transactions: tokenInputs + guardInput + adminInput + feeInput
    const totalTxInputCount = inputTokenCount + 3
    // For burn transactions: adminOutput + changeOutput (typically 1-2 outputs)
    const totalTxOutputCount = 2 // Conservative estimate for admin output + change
    const { guard, txInputCountMax: finalTxInputCountMax, txOutputCountMax } = this.selectCAT20Guard(
      totalTxInputCount,
      totalTxOutputCount,
      guardTokenTypes
    )

    const outputTokens = fill(undefined, TX_OUTPUT_COUNT_MAX)

    return {
      guard,
      guardState,
      outputTokens,
      txInputCountMax: finalTxInputCountMax,
      txOutputCountMax,
    }
  }

  static async getBackTraceInfo(
    minterScrtptHash: string,
    inputTokenUtxos: UTXO[],
    provider: UtxoProvider & ChainProvider,
    hasAdmin: boolean = false,
    adminScriptHash: string = NULL_ADMIN_SCRIPT_HASH
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
        CAT20GuardPeripheral.getGuardVariantScriptHashes(),
        hasAdmin,
        adminScriptHash
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

/**
 * Helper class for CAT721 guard peripheral operations
 * @category Utils
 */
export class CAT721GuardPeripheral {
  static getGuardVariantScriptHashes() {
    const guardVariantScriptHashes: FixedArray<Sha256, typeof NFT_GUARD_VARIANTS_COUNT> = fill(
      '' as Sha256,
      NFT_GUARD_VARIANTS_COUNT
    )
    guardVariantScriptHashes[0] = ContractPeripheral.scriptHash(new CAT721Guard_6_6_2())
    guardVariantScriptHashes[1] = ContractPeripheral.scriptHash(new CAT721Guard_6_6_4())
    guardVariantScriptHashes[2] = ContractPeripheral.scriptHash(new CAT721Guard_12_12_2())
    guardVariantScriptHashes[3] = ContractPeripheral.scriptHash(new CAT721Guard_12_12_4())
    return guardVariantScriptHashes;
  }

  /**
   * Select appropriate CAT721 guard based on input/output count and collection types
   * @param txInputCount - Total number of transaction inputs
   * @param txOutputCount - Total number of transaction outputs
   * @param guardCollectionTypes - Number of unique NFT collection types
   * @returns guard - The selected guard contract instance
   * @returns txInputCountMax - Maximum input count for the selected guard
   * @returns txOutputCountMax - Maximum output count for the selected guard
   */
  public static selectCAT721Guard(
    txInputCount: number,
    txOutputCount: number,
    guardCollectionTypes: number
  ): {
    guard: CAT721GuardVariant
    txInputCountMax: typeof TX_INPUT_COUNT_MAX_6 | typeof TX_INPUT_COUNT_MAX_12
    txOutputCountMax: typeof TX_OUTPUT_COUNT_MAX_6 | typeof TX_OUTPUT_COUNT_MAX_12
  } {

    if (txInputCount > TX_INPUT_COUNT_MAX) {
      throw new Error(`Too many transaction inputs that exceed the maximum limit of ${TX_INPUT_COUNT_MAX}`)
    }
    if (txOutputCount > TX_OUTPUT_COUNT_MAX) {
      throw new Error(`Too many transaction outputs that exceed the maximum limit of ${TX_OUTPUT_COUNT_MAX}`)
    }

    let guard: CAT721GuardVariant
    let txInputCountMax: typeof TX_INPUT_COUNT_MAX_6 | typeof TX_INPUT_COUNT_MAX_12
    let txOutputCountMax: typeof TX_OUTPUT_COUNT_MAX_6 | typeof TX_OUTPUT_COUNT_MAX_12

    if (txInputCount <= TX_INPUT_COUNT_MAX_6 && txOutputCount <= TX_OUTPUT_COUNT_MAX_6) {
      txInputCountMax = TX_INPUT_COUNT_MAX_6
      txOutputCountMax = TX_OUTPUT_COUNT_MAX_6
      if (guardCollectionTypes <= NFT_GUARD_COLLECTION_TYPE_MAX_2) {
        guard = new CAT721Guard_6_6_2()
      } else {
        guard = new CAT721Guard_6_6_4()
      }
    } else {
      txInputCountMax = TX_INPUT_COUNT_MAX_12
      txOutputCountMax = TX_OUTPUT_COUNT_MAX_12
      if (guardCollectionTypes <= NFT_GUARD_COLLECTION_TYPE_MAX_2) {
        guard = new CAT721Guard_12_12_2()
      } else {
        guard = new CAT721Guard_12_12_4()
      }
    }

    return { guard, txInputCountMax, txOutputCountMax }
  }

  /**
   * Process NFT inputs and extract script hashes mapping
   * @returns nftScriptHashes - Map of NFT type index to script hash
   * @returns nftScriptIndexes - ByteString with indexed NFT script types
   * @returns guardCollectionTypes - Number of unique NFT collection types
   */
  private static processNftInputs(
    nftInputs: { nft: UTXO; inputIndex: number }[],
    initialNftScriptIndexes: ByteString
  ): {
    nftScriptHashes: Map<number, string>
    nftScriptIndexes: ByteString
    guardCollectionTypes: number
  } {
    const scriptHashToIndex = new Map<string, number>()
    const nftScriptHashes = new Map<number, string>()

    // Map each unique NFT script hash to an index
    for (const input of nftInputs) {
      const scriptHash = ContractPeripheral.scriptHash(input.nft.script)
      if (!scriptHashToIndex.has(scriptHash)) {
        const index = scriptHashToIndex.size
        scriptHashToIndex.set(scriptHash, index)
        nftScriptHashes.set(index, scriptHash)
      }
    }

    // Build nftScriptIndexes by modifying individual bytes
    let nftScriptIndexes = initialNftScriptIndexes
    for (
      let index = 0;
      index < nftInputs.length && index < TX_INPUT_COUNT_MAX;
      index++
    ) {
      const inputIndex = nftInputs[index].inputIndex
      const scriptHash = ContractPeripheral.scriptHash(nftInputs[index].nft.script)
      const typeIndex = scriptHashToIndex.get(scriptHash)!
      const before = slice(nftScriptIndexes, 0n, BigInt(inputIndex))
      const after = slice(nftScriptIndexes, BigInt(inputIndex + 1))
      nftScriptIndexes = before + intToByteString(BigInt(typeIndex), 1n) + after
    }

    const guardCollectionTypes = nftScriptHashes.size;
    if (guardCollectionTypes > NFT_GUARD_COLLECTION_TYPE_MAX) {
      throw new Error(`Too many NFT collection types that exceed the maximum limit of ${NFT_GUARD_COLLECTION_TYPE_MAX}`)
    }

    return {
      nftScriptHashes,
      nftScriptIndexes,
      guardCollectionTypes,
    }
  }
  static createTransferGuard(
    nftInputs: {
      nft: UTXO,
      inputIndex: number
    }[],
    receivers: ByteString[],
    txInputCount: number,
    txOutputCount: number,
    deployerAddr: ByteString,
  ): {
    guard: CAT721GuardVariant
    guardState: CAT721GuardConstState,
    outputNfts: FixedArray<CAT721State | undefined, typeof TX_OUTPUT_COUNT_MAX>
    txInputCountMax: typeof TX_INPUT_COUNT_MAX_6 | typeof TX_INPUT_COUNT_MAX_12
    txOutputCountMax: typeof TX_OUTPUT_COUNT_MAX_6 | typeof TX_OUTPUT_COUNT_MAX_12
  } {
    if (txInputCount >= TX_INPUT_COUNT_MAX) {
      throw new Error(`Too many transaction inputs that exceed the maximum limit of ${TX_INPUT_COUNT_MAX}`)
    }
    if (txOutputCount > TX_OUTPUT_COUNT_MAX) {
      throw new Error(`Too many transaction outputs that exceed the maximum limit of ${TX_OUTPUT_COUNT_MAX}`)
    }
    if (nftInputs.length + 1 > TX_INPUT_COUNT_MAX) {
      throw new Error(`Too many nft inputs that exceed the maximum limit of ${TX_INPUT_COUNT_MAX - 1}`)
    }
    if (receivers.length > TX_OUTPUT_COUNT_MAX) {
      throw new Error(`Too many nft outputs that exceed the maximum limit of ${TX_OUTPUT_COUNT_MAX}`)
    }
    if (nftInputs.length === 0) {
      throw new Error('No spent nfts')
    }
    if (receivers.length !== nftInputs.length) {
      throw new Error('Receivers length does not match the number of nft inputs')
    }

    // Determine which size guard to use based on input count
    const txInputCountMax = txInputCount <= TX_INPUT_COUNT_MAX_6 ? TX_INPUT_COUNT_MAX_6 : TX_INPUT_COUNT_MAX_12

    // Create guard state to get the initial nftScriptIndexes
    const guardState = CAT721GuardStateLib.createEmptyState(txInputCountMax)
    guardState.deployerAddr = deployerAddr

    // Process NFT inputs to get script hash mapping
    const { nftScriptHashes, nftScriptIndexes, guardCollectionTypes } = this.processNftInputs(
      nftInputs,
      guardState.nftScriptIndexes
    )

    // Select guard based on counts and collection types
    const { guard, txInputCountMax: finalTxInputCountMax, txOutputCountMax } = this.selectCAT721Guard(
      txInputCount,
      txOutputCount,
      guardCollectionTypes
    )

    // Set the processed data to guardState
    nftScriptHashes.forEach((scriptHash, index) => {
      guardState.nftScriptHashes[index] = scriptHash
    })
    guardState.nftScriptIndexes = nftScriptIndexes

    const nftStates = nftInputs.map((utxo) => CAT721StateLib.deserializeState(utxo.nft.data))
    const outputNfts = emptyOutputByteStrings().map((_, index) => {
      const receiver = receivers[index]
      return receiver ? CAT721StateLib.create(nftStates[index].localId, receiver) : undefined
    }) as FixedArray<CAT721State | undefined, typeof TX_OUTPUT_COUNT_MAX>

    return {
      guard,
      guardState,
      outputNfts,
      txInputCountMax: finalTxInputCountMax,
      txOutputCountMax,
    }
  }

  static createBurnGuard(
    nftInputs: {
      nft: UTXO,
      inputIndex: number
    }[],
    deployerAddr: ByteString,
  ): {
    guard: CAT721GuardVariant
    guardState: CAT721GuardConstState,
    txInputCountMax: typeof TX_INPUT_COUNT_MAX_6 | typeof TX_INPUT_COUNT_MAX_12
    txOutputCountMax: typeof TX_OUTPUT_COUNT_MAX_6 | typeof TX_OUTPUT_COUNT_MAX_12
  } {
    if (nftInputs.length === 0) {
      throw new Error('No spent nfts')
    }

    // Validate counts first
    const inputNftCount = nftInputs.length
    const outputNftCount = 0 // No NFT outputs for burn

    // Validate input NFT count
    if (inputNftCount > TX_INPUT_COUNT_MAX - 1) {
      throw new Error(
        `Too many nft inputs that exceed the maximum limit of ${TX_INPUT_COUNT_MAX - 1}`
      )
    }

    // Determine which size guard to use based on input count
    const txInputCountMax = (inputNftCount + 1) <= TX_INPUT_COUNT_MAX_6 ? TX_INPUT_COUNT_MAX_6 : TX_INPUT_COUNT_MAX_12

    // Create guard state to get the initial nftScriptIndexes
    const guardState = CAT721GuardStateLib.createEmptyState(txInputCountMax)
    guardState.deployerAddr = deployerAddr

    // Process NFT inputs to get script hash mapping
    const { nftScriptHashes, nftScriptIndexes, guardCollectionTypes } = this.processNftInputs(
      nftInputs,
      guardState.nftScriptIndexes
    )

    // Select guard based on counts and collection types
    const { guard, txInputCountMax: finalTxInputCountMax, txOutputCountMax } = this.selectCAT721Guard(
      inputNftCount + 1,
      outputNftCount,
      guardCollectionTypes
    )

    // Set the processed data to guardState
    nftScriptHashes.forEach((scriptHash, index) => {
      guardState.nftScriptHashes[index] = scriptHash
    })
    guardState.nftScriptIndexes = nftScriptIndexes

    // Build nftBurnMasks by setting each byte to '01' for true
    let nftBurnMasks = guardState.nftBurnMasks
    for (let index = 0; index < nftInputs.length; index++) {
      const before = slice(nftBurnMasks, 0n, BigInt(index))
      const after = slice(nftBurnMasks, BigInt(index + 1))
      nftBurnMasks = before + toByteString('01') + after
    }
    guardState.nftBurnMasks = nftBurnMasks

    return {
      guard,
      guardState,
      txInputCountMax: finalTxInputCountMax,
      txOutputCountMax
    }
  }

  static async getBackTraceInfo(
    minterScrtptHash: string,
    inputNftUtxos: UTXO[],
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
    const expectNftScriptHash = ContractPeripheral.scriptHash(
      new CAT721(
        minterScrtptHash,
        CAT721GuardPeripheral.getGuardVariantScriptHashes()
      )
    )

    for (const inputNftUtxo of inputNftUtxos) {
      const utxoScriptHash = ContractPeripheral.scriptHash(inputNftUtxo.script)
      if (utxoScriptHash !== expectNftScriptHash) {
        throw new Error(`Nft utxo ${JSON.stringify(inputNftUtxo)} does not match the nft script hash ${expectNftScriptHash}`)
      }
    }

    for (const inputNftUtxo of inputNftUtxos) {
      const nftTxHex = await getRawTx(inputNftUtxo.txId)
      const nftTx = new Transaction(nftTxHex)
      let nftPrevTxHex: string | undefined
      let nftTxInputIndex: number | undefined
      for (let idx = 0; idx < nftTx.inputs.length; idx++) {
        const input = nftTx.inputs[idx]
        const prevTxId = toHex(input.prevTxId)
        const prevTxHex = await getRawTx(prevTxId)
        const prevTx = new Transaction(prevTxHex)
        const out = prevTx.outputs[input.outputIndex]
        const outScriptHash = ContractPeripheral.scriptHash(out.script.toHex())
        if (outScriptHash === minterScrtptHash || outScriptHash === expectNftScriptHash) {
          nftPrevTxHex = prevTxHex
          nftTxInputIndex = idx
          break
        }
      }
      if (nftPrevTxHex == undefined || nftTxInputIndex === undefined) {
        throw new Error(`Nft utxo ${JSON.stringify(inputNftUtxo)} can not be backtraced`)
      }
      results.push({
        prevTxHex: nftTxHex,
        prevTxInput: nftTxInputIndex!,
        prevPrevTxHex: nftPrevTxHex!,
      })
    }
    return results
  }
}

/**
 * Helper class for CAT721 open minter peripheral operations
 * @category Utils
 */
export class CAT721OpenMinterPeripheral {
  static createMinter(
    nftId: string,
    metadata: OpenMinterCAT721Meta
  ) {

    const contract = new CAT721OpenMinter(
      outpoint2ByteString(nftId),
      metadata.max,
      metadata.premine,
      metadata.preminerAddr
    )
    contract.checkProps()
    return contract
  }
}

/**
 * Helper class for CAT721 closed minter peripheral operations
 * @category Utils
 */
export class CAT721ClosedMinterPeripheral {
  static createMinter(
    collectionId: string,
    metadata: ClosedMinterCAT721Meta
  ) {
    const contract = new CAT721ClosedMinter(
      metadata.issuerAddress,
      outpoint2ByteString(collectionId),
      metadata.max
    )
    contract.checkProps()
    return contract
  }
}

export class CAT20Peripheral {
  isCAT20Supported(
    cat20ScriptHexOrScriptHash: string,
    minterScriptHash: string,
    hasAdmin: boolean,
    adminScriptHash: string
  ) {
    const cat20 = new CAT20(
      minterScriptHash,
      CAT20GuardPeripheral.getGuardVariantScriptHashes(),
      hasAdmin,
      adminScriptHash
    )
    const lockingScriptHex = cat20.lockingScript.toHex()
    const lockingScriptHash = ContractPeripheral.scriptHash(lockingScriptHex)
    return cat20ScriptHexOrScriptHash === lockingScriptHex || cat20ScriptHexOrScriptHash === lockingScriptHash
  }
}

export class CAT721Peripheral {
  isCAT721Supported(
    cat721ScriptHexOrScriptHash: string,
    minterScriptHash: string
  ) {
    const cat721 = new CAT721(minterScriptHash, CAT721GuardPeripheral.getGuardVariantScriptHashes())
    const lockingScriptHex = cat721.lockingScript.toHex()
    const lockingScriptHash = ContractPeripheral.scriptHash(lockingScriptHex)
    return cat721ScriptHexOrScriptHash === lockingScriptHex || cat721ScriptHexOrScriptHash === lockingScriptHash
  }
}