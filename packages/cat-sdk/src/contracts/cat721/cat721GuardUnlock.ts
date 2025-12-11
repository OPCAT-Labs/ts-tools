import {
  fill,
  toByteString,
  toHex,
  sha256,
  IExtPsbt,
} from '@opcat-labs/scrypt-ts-opcat'
import { CAT721State } from './types.js'
import { CAT721StateLib } from './cat721StateLib.js'
import { ContractPeripheral } from '../../utils/contractPeripheral.js'

/**
 * Parameters for unlocking a CAT721Guard contract via the @unlock decorator pattern.
 *
 * @category CAT721
 */
export interface CAT721GuardUnlockParams extends Record<string, unknown> {
  /** Input NFT states */
  inputNftStates: CAT721State[];
  /** Output NFT states */
  outputNftStates: CAT721State[];
  /** Maximum input count for this guard variant */
  txInputCountMax: number;
  /** Maximum output count for this guard variant */
  txOutputCountMax: number;
}

/**
 * Helper function to build unlock parameters for CAT721Guard.
 * This is used by the @unlock static methods in each Guard variant.
 */
export function buildCAT721GuardUnlockArgs(
  psbt: IExtPsbt,
  inputNftStates: CAT721State[],
  outputNftStates: CAT721State[],
  txInputCountMax: number,
  txOutputCountMax: number
): {
  nextStateHashes: string[];
  ownerAddrOrScriptHashes: string[];
  outputLocalIds: bigint[];
  nftScriptIndexArray: bigint[];
  outputSatoshis: bigint[];
  inputCAT721States: CAT721State[];
  outputCount: bigint;
} {
  const ownerAddrOrScriptHashes = fill(toByteString(''), txOutputCountMax)
  applyFixedArray(
    ownerAddrOrScriptHashes,
    psbt.txOutputs.map((output, index) => {
      return index < outputNftStates.length
        ? outputNftStates[index].ownerAddr
        : ContractPeripheral.scriptHash(toHex(output.script))
    })
  )

  // For CAT721, outputLocalIds are the localIds of output NFTs in order
  const outputLocalIds = fill(-1n, txOutputCountMax)
  applyFixedArray(
    outputLocalIds,
    outputNftStates.map((nft) => nft.localId)
  )

  const nftScriptIndexArray = fill(-1n, txOutputCountMax)
  applyFixedArray(
    nftScriptIndexArray,
    outputNftStates.map(() => 0n)
  )

  const outputSatoshis = fill(0n, txOutputCountMax)
  applyFixedArray(
    outputSatoshis,
    psbt.txOutputs.map((output) => output.value)
  )

  const inputCAT721States = fill(
    CAT721StateLib.create(0n, ''),
    txInputCountMax
  )
  applyFixedArray(inputCAT721States, inputNftStates)

  const nextStateHashes = fill(toByteString(''), txOutputCountMax)
  applyFixedArray(
    nextStateHashes,
    psbt.txOutputs.map((output) => sha256(toHex(output.data)))
  )

  return {
    nextStateHashes,
    ownerAddrOrScriptHashes,
    outputLocalIds,
    nftScriptIndexArray,
    outputSatoshis,
    inputCAT721States,
    outputCount: BigInt(psbt.txOutputs.length),
  }
}

/**
 * Helper function to apply values to a fixed array.
 */
function applyFixedArray<T>(target: T[], source: T[]): void {
  for (let i = 0; i < source.length && i < target.length; i++) {
    target[i] = source[i]
  }
}
