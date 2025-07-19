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

export const outpoint2ByteString = function (outpoint: string) {
  const txOutpoint = outpoint2TxOutpoint(outpoint)
  return txOutpoint.txHash + txOutpoint.outputIndex
}

// export const getBackTraceInfo = function (
//   prevTxHex: string,
//   prevPrevTxHex: string,
//   prevTxInputIndex: number
// ): BacktraceInfo {
//   const prevTx = new Transaction(prevTxHex)
//   const prevPrevTx = new Transaction(prevPrevTxHex)

//   const prevTxPreimage = txHashBufToObj(prevTx.toTxHashPreimage())
//   const prevPrevTxPreimage = txHashBufToObj(prevPrevTx.toTxHashPreimage())

//   let index = 0n
//   // txinput prevout(36) + sha256(unlockingScript)(32) + sequence(4)
//   const prevTxInput: TxIn = {
//     prevTxHash: slice(
//       prevTxPreimage.inputList[prevTxInputIndex],
//       index,
//       (index += 32n)
//     ),
//     prevOutputIndex: StdUtils.fromLEUnsigned(slice(prevTxPreimage.inputList[prevTxInputIndex], index, (index += 4n))),
//     scriptHash: slice(
//       prevTxPreimage.inputList[prevTxInputIndex],
//       index,
//       (index += 32n)
//     ),
//     sequence: StdUtils.fromLEUnsigned(slice(prevTxPreimage.inputList[prevTxInputIndex], index, (index += 4n))),
//   }
//   return {
//     prevTxPreimage,
//     prevTxInput,
//     prevTxInputIndexVal: BigInt(prevTxInputIndex),
//     prevPrevTxPreimage,
//   }
// }

// export function satoshiToHex(value: bigint | number): ByteString {
//   const bw = new opcat.encoding.BufferWriter()
//   bw.writeUInt64LEBN(opcat.crypto.BN.fromNumber(Number(value)))
//   return toByteString(toHex(bw.toBuffer()))
// }

// export function txHashBufToObj(buf: Buffer): TxHashPreimage {
//   const br = new opcat.encoding.BufferReader(buf)
//   const version = toHex(br.read(4))
//   const inputCountVal = BigInt(br.readVarintNum())
//   const inputList = fill(toByteString(''), TX_INPUT_COUNT_MAX)

//   for (let i = 0; i < inputCountVal; i++) {
//     // prevout + unlockingScriptHash + sequence
//     inputList[i] = toHex(br.read(36 + 32 + 4))
//   }

//   const outputCountVal = BigInt(br.readVarintNum())
//   const outputList = fill(toByteString(''), TX_OUTPUT_COUNT_MAX)
//   for (let i = 0; i < outputCountVal; i++) {
//     // satoshis + scriptHash + dataHash
//     outputList[i] = toHex(br.read(8 + 32 + 32))
//   }
//   const locktime = toHex(br.read(4))

//   checkState(br.eof(), 'txHashBufToObj error, buf length greater than expect')

//   return {
//     version,
//     inputCountVal,
//     inputList,
//     outputCountVal,
//     outputList,
//     locktime,
//   }
// }

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

export function stringToHex(str: string): string {
  let hex = ''
  const utf8Bytes: Uint8Array = new TextEncoder().encode(str)
  for (let i = 0; i < utf8Bytes.length; i++) {
    hex += utf8Bytes[i].toString(16).padStart(2, '0')
  }

  return hex
}

export function hexToString(str: string): string {
  const bytes = new Uint8Array(
    str.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16))
  )
  return new TextDecoder().decode(bytes)
}

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
