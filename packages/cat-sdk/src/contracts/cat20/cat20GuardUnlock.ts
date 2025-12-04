import {
  fill,
  toByteString,
  toHex,
  sha256,
  IExtPsbt,
} from '@opcat-labs/scrypt-ts-opcat'
import { CAT20State } from './types.js'
import { CAT20StateLib } from './cat20StateLib.js'
import { ContractPeripheral } from '../../utils/contractPeripheral.js'

/**
 * Parameters for unlocking a CAT20Guard contract via the @unlock decorator pattern.
 *
 * @category CAT20
 */
export interface CAT20GuardUnlockParams extends Record<string, unknown> {
  /** Input token states */
  inputTokenStates: CAT20State[];
  /** Output token states */
  outputTokenStates: CAT20State[];
  /** Maximum input count for this guard variant */
  txInputCountMax: number;
  /** Maximum output count for this guard variant */
  txOutputCountMax: number;
}

/**
 * Helper function to build unlock parameters for CAT20Guard.
 * This is used by the @unlock static methods in each Guard variant.
 */
export function buildCAT20GuardUnlockArgs(
  psbt: IExtPsbt,
  inputTokenStates: CAT20State[],
  outputTokenStates: CAT20State[],
  txInputCountMax: number,
  txOutputCountMax: number
): {
  nextStateHashes: string[];
  ownerAddrOrScriptHashes: string[];
  outputTokenAmts: bigint[];
  tokenScriptIndexArray: bigint[];
  outputSatoshis: bigint[];
  inputCAT20States: CAT20State[];
  outputCount: bigint;
} {
  const ownerAddrOrScriptHashes = fill(toByteString(''), txOutputCountMax)
  applyFixedArray(
    ownerAddrOrScriptHashes,
    psbt.txOutputs.map((output, index) => {
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
    psbt.txOutputs.map((output) => output.value)
  )

  const inputCAT20States = fill(
    CAT20StateLib.create(0n, ''),
    txInputCountMax
  )
  applyFixedArray(inputCAT20States, inputTokenStates)

  const nextStateHashes = fill(toByteString(''), txOutputCountMax)
  applyFixedArray(
    nextStateHashes,
    psbt.txOutputs.map((output) => sha256(toHex(output.data)))
  )

  return {
    nextStateHashes,
    ownerAddrOrScriptHashes,
    outputTokenAmts,
    tokenScriptIndexArray,
    outputSatoshis,
    inputCAT20States,
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
