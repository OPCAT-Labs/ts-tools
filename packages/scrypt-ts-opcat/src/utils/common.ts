/* eslint-disable @typescript-eslint/no-explicit-any */
import { bn, Network, networks, payments, TxInput } from '@scrypt-inc/bitcoinjs-lib';
import { SupportedNetwork } from '../globalTypes.js';
import {
  ByteString,
  FixedArray,
  InputStateProof,
  SigHashType,
  StateHashes,
} from '../smart-contract/types/index.js';
import * as tools from 'uint8array-tools';
import { STATE_OUTPUT_COUNT_MAX } from '../smart-contract/consts.js';

/**
 * Converts a Uint8Array to a hexadecimal string.
 * @param {Uint8Array} bytes - The input array of bytes.
 * @returns {string} The hexadecimal representation of the input bytes.
 */
export function uint8ArrayToHex(bytes: Uint8Array): string {
  return tools.toHex(bytes);
}

/**
 * Converts a hexadecimal string to a Uint8Array.
 * @param {string} hex - The hexadecimal string.
 * @returns {Uint8Array} The resulting Uint8Array.
 */
export function hexToUint8Array(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) {
    throw new Error('Hex string must have an even length');
  }
  return tools.fromHex(hex);
}

/**
 * convert `SupportedNetwork` to bitcoinjs-lib network
 * @param network
 * @returns
 */
export function toBitcoinNetwork(network: SupportedNetwork): Network {
  if (network === 'btc-signet') {
    return networks.testnet;
  } else if (network === 'fractal-mainnet' || network === 'fractal-testnet') {
    return networks.bitcoin;
  } else {
    throw new Error(`invalid network ${network}`);
  }
}

/**
 * convert bigint to `ByteString`
 * @param n
 * @param size
 * @returns
 */
export function bigintToByteString(n: bigint, size: bigint): ByteString {
  let hex = n.toString(16);
  hex = hex.padStart(Number(size) * 2, '0');

  if (hex.length > Number(size) * 2) {
    throw new Error(`bigint out of range, bigint: ${n}, size: ${size}`);
  }

  // to little endian
  const le = tools.fromHex(hex).reverse();
  return tools.toHex(le);
}

/**
 * convert p2tr locking script to address
 * @param p2tr
 * @param network
 * @returns
 */
export function p2trLockingScriptToAddr(p2tr: string, network: SupportedNetwork) {
  return payments.p2tr({
    output: hexToUint8Array(p2tr),
    network: toBitcoinNetwork(network),
  }).address;
}

/**
 * create a FixedArray and fill it with initial value
 * @param value
 * @param len
 * @returns
 */
export function fillFixedArray<T, Length extends number>(
  value: T,
  len: Length,
): FixedArray<T, Length> {
  const array = new Array<T>(len as number);
  array.fill(value);
  return array as FixedArray<T, Length>;
}

/**
 * create a empty ByteString
 * @returns a empty ByteString
 */
export function emptyByteString(): ByteString {
  return '';
}

/**
 * create a empty InputStateProof
 * @returns a empty InputStateProof
 */
export function emptyInputStateProof(): InputStateProof {
  return {
    txHashPreimage: {
      version: emptyByteString(),
      inputCountVal: 0n,
      inputList: fillFixedArray(emptyByteString(), 6),
      outputCountVal: 0n,
      hashRoot: emptyByteString(),
      suffixList: fillFixedArray(emptyByteString(), 4),
    },
    outputIndexVal: 0n,
    stateHashes: fillFixedArray(emptyByteString(), STATE_OUTPUT_COUNT_MAX),
  };
}

/**
 * pubKey in x-only format
 * @param pubKeyHex
 * @param isP2TR
 * @returns
 */
export function toXOnly(pubKeyHex: string, isP2TR: boolean): string {
  let pubKey = hexToUint8Array(pubKeyHex);
  if (pubKey.length === 33) {
    pubKey = pubKey.slice(1, 33);
  }
  if (pubKey.length !== 32) {
    throw new Error('Invalid pubkey length');
  }
  if (isP2TR) {
    const payment = payments.p2tr({
      internalPubkey: pubKey,
    });
    return uint8ArrayToHex(payment.pubkey);
  } else {
    return uint8ArrayToHex(pubKey);
  }
}

/**
 * convert SigHashType to a number
 * @param sighashType
 * @returns
 */
export function sigHashTypeToNumber(sighashType: SigHashType): number {
  return parseInt(sighashType, 16);
}
// export function xPubkeyToAddr(xPubkey: string, network: SupportedNetwork = 'fractal-mainnet') {
//   return p2trLockingScriptToAddr(xPubkeyToP2trLockingScript(xPubkey).toHex(), network);
// }

/** @ignore */
export function requireTrue(res: boolean, message: string) {
  if (!res) {
    throw new Error(message);
  }
}

/** @ignore */
export function getTxId(input: TxInput): string {
  const hash = input.hash.slice();
  return uint8ArrayToHex(hash.reverse());
}

/**
 * create StateHashes with empty value
 * @returns
 */
export function emptyStateHashes(): StateHashes {
  return fillFixedArray(emptyByteString(), STATE_OUTPUT_COUNT_MAX);
}

/** @ignore */
export function cloneDeep<T>(obj: T, hash = new WeakMap()): T {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (hash.has(obj as object)) {
    return hash.get(obj as object);
  }

  if (obj instanceof Date) {
    return new Date(obj.getTime()) as unknown as T;
  }

  if (obj instanceof RegExp) {
    return new RegExp(obj) as unknown as T;
  }

  if (ArrayBuffer.isView(obj) && !(obj instanceof DataView)) {
    const constructor = obj.constructor as new (buffer: ArrayBuffer | SharedArrayBuffer) => any;
    return new constructor(obj.buffer.slice(0)) as unknown as T;
  }

  if (obj instanceof ArrayBuffer) {
    return obj.slice(0) as unknown as T;
  }

  if (obj instanceof DataView) {
    const buffer = obj.buffer.slice(0);
    return new DataView(buffer, obj.byteOffset, obj.byteLength) as unknown as T;
  }

  if (obj instanceof Map) {
    const copy = new Map();
    hash.set(obj as object, copy);
    obj.forEach((value, key) => {
      copy.set(cloneDeep(key, hash), cloneDeep(value, hash));
    });
    return copy as unknown as T;
  }

  if (obj instanceof Set) {
    const copy = new Set();
    hash.set(obj as object, copy);
    obj.forEach((value) => {
      copy.add(cloneDeep(value, hash));
    });
    return copy as unknown as T;
  }

  if (Array.isArray(obj)) {
    const copy = [] as unknown as T;
    hash.set(obj as object, copy);
    (obj as unknown[]).forEach((item, index) => {
      (copy as unknown[])[index] = cloneDeep(item, hash);
    });
    return copy;
  }

  const copy = {} as T;
  hash.set(obj as object, copy);

  Object.setPrototypeOf(copy, Object.getPrototypeOf(obj));

  const allProps = [...Object.getOwnPropertyNames(obj), ...Object.getOwnPropertySymbols(obj)];

  allProps.forEach((key) => {
    const descriptor = Object.getOwnPropertyDescriptor(obj, key);
    if (descriptor) {
      if (descriptor.get || descriptor.set) {
        Object.defineProperty(copy, key, descriptor);
      } else {
        Object.defineProperty(copy, key, {
          ...descriptor,
          value: cloneDeep(descriptor.value, hash),
        });
      }
    }
  });

  return copy;
}

/**
 * convert a ByteString to bigint.
 * @param a
 * @returns
 */
export function byteStringToBigInt(a: ByteString): bigint {
  const n = bn.buf2BN(hexToUint8Array(a), false);
  return n;
}

/**
 * convert satoshi to hex in little-endian order
 * @param value
 * @returns
 */
export function satoshiToHex(value: bigint): string {
  const bf = new Uint8Array(8);
  tools.writeUInt64(bf, 0, value, 'LE');
  return uint8ArrayToHex(bf);
}

/**
 * convert utf8 text to hex string
 * @param text
 * @returns
 */
export function textToHex(text: string): string {
  return uint8ArrayToHex(tools.fromUtf8(text));
}

export function duplicateFilter<T>(uniqueFn: (item: T) => any) {
  return function (value: T, index: number, arr: T[]) {
    const uniqueArr = arr.map(uniqueFn);
    const uniqueIndex = uniqueArr.findIndex((t) => t === uniqueFn(value));
    return uniqueIndex === index;
  };
}
