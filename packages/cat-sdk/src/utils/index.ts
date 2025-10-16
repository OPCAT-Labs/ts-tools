import {
  ByteString,
  FixedArray,
  SmartContract,
  fill,
  len,
  sha256,
  toByteString,
  UTXO,
} from '@opcat-labs/scrypt-ts-opcat'
import { TX_OUTPUT_COUNT_MAX } from '../contracts/constants'
import { Outpoint } from '../typeConstants'
import { randomBytes } from 'crypto'
import * as opcat from '@opcat-labs/opcat'

/// proxy a class instance, and get the calling method and arguments
export function proxyClass<T extends object>(
  targetInstance: T,
  delegateMethods: string[]
): {
  proxyiedInstance: T
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getCalling: () => { method: string; args: any[] }
} {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let calling: { method: string; args: any[] } = { method: '', args: [] }

  const proxyiedInstance = new Proxy(targetInstance, {
    get(target, prop) {
      if (delegateMethods.includes(prop as string)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return (...args: any[]) => {
          calling = { method: prop as string, args }
        }
      }
      return target[prop as keyof T]
    },
  })

  return {
    proxyiedInstance,
    getCalling: () => {
      return calling
    },
  }
}

/// proxy smart contract instance public methods
export function proxySmartContract<T extends SmartContract>(
  targetInstance: T
): {
  proxyiedInstance: T
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getCalling: () => { method: string; args: any[] }
} {
  const instancePublicMethods =
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ((targetInstance as any).getDelegateClazz() as any).abi
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((func: any) => func.type === 'function')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((func: any) => func.name)
  return proxyClass(targetInstance, instancePublicMethods)
}

/**
 * @category Utils
 * @param txid the transaction id
 * @param outputIndex the output index
 * @returns the outpoint
 */
export function toTxOutpoint(txid: string, outputIndex: number): Outpoint {
  const outputBuf = Buffer.alloc(4, 0)
  outputBuf.writeUInt32LE(outputIndex)
  return {
    txHash: Buffer.from(txid, 'hex').reverse().toString('hex'),
    outputIndex: outputBuf.toString('hex'),
  }
}

export function outpoint2TxOutpoint(outpoint: string): Outpoint {
  const [txid, vout] = outpoint.split('_')
  return toTxOutpoint(txid, parseInt(vout))
}

/**
 * @category Utils
 * @param outpoint the outpoint, txid_vout
 * @returns the outpoint in byte string
 */
export const outpoint2ByteString = function (outpoint: string) {
  const txOutpoint = outpoint2TxOutpoint(outpoint)
  return txOutpoint.txHash + txOutpoint.outputIndex
}


/**
 * @category Utils
 * @param addressOrScriptHex the address or script hex
 * @param forceContractAddress whether to force the contract address, default is false
 * @returns the token owner address, p2pkh script hex or contract script hash
 */
export function toTokenOwnerAddress(
  addressOrScriptHex: string,
  forceContractAddress = false
): ByteString {
  let scriptHex: string
  if (opcat.util.js.isHexaString(addressOrScriptHex)) {
    scriptHex = addressOrScriptHex
  } else {
    scriptHex = opcat.Script.fromAddress(addressOrScriptHex).toHex()
  }

  if (forceContractAddress) {
    return sha256(scriptHex)
  }

  if (isp2pkh(scriptHex)) {
    return toByteString(scriptHex)
  }
  throw new Error(`Invalid address: ${addressOrScriptHex}, must be p2pkh`)
}

function isp2pkh(scriptHex: ByteString): boolean {
  return (
    len(scriptHex) == 25n &&
    scriptHex.startsWith('76a914') &&
    scriptHex.endsWith('88ac')
  )
}

export function filterFeeUtxos(utxos: UTXO[]): UTXO[] {
  return utxos
    .sort((a, b) => b.satoshis - a.satoshis)
    .filter((utxo) => utxo.satoshis >= 10000)
}

export const emptyString = toByteString('')
export const emptyOutputByteStrings = function () {
  return fill(emptyString, TX_OUTPUT_COUNT_MAX)
}

export function applyFixedArray<T, L extends number>(
  target: FixedArray<T, L>,
  changes: T[],
  targetStartIndex = 0
): void {
  for (
    let i = 0;
    i < changes.length && i + targetStartIndex < target.length;
    i++
  ) {
    target[i + targetStartIndex] = changes[i]
  }
}

/**
 * @category Utils
 * @param str the string
 * @returns the hex string
 */
export function stringToHex(str: string): string {
  let hex = ''
  const utf8Bytes: Uint8Array = new TextEncoder().encode(str)
  for (let i = 0; i < utf8Bytes.length; i++) {
    hex += utf8Bytes[i].toString(16).padStart(2, '0')
  }

  return hex
}

/**
 * @category Utils
 * @param str the hex string
 * @returns the string
 */
export function hexToString(str: string): string {
  const bytes = new Uint8Array(
    str.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16))
  )
  return new TextDecoder().decode(bytes)
}

/**
 * @category Utils
 * @param _address the address of the utxo
 * @param satoshis the satoshis of the utxo
 * @param data the data of the utxo
 * @returns the dummy utxo
 */
export function getDummyUtxo(
  _address?: string,
  satoshis?: number,
  data?: string
): UTXO {
  const address = _address || 'miVPLmATcYqnfiFA9yKdJG1VHQzFsp4Uz2'
  const scriptHex = opcat.Script.fromAddress(address).toHex()

  return {
    address: _address,
    txId: randomBytes(32).toString('hex'),
    outputIndex: 0,
    script: scriptHex,
    satoshis: satoshis || 10e8,
    data: data || '',
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function duplicateFilter<T>(uniqueFn: (item: T) => any) {
  return function (value: T, index: number, arr: T[]) {
    const uniqueArr = arr.map(uniqueFn)
    const uniqueIndex = uniqueArr.findIndex((t) => t === uniqueFn(value))
    return uniqueIndex === index
  }
}
