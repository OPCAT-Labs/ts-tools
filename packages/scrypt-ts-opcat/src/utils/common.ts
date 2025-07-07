/* eslint-disable @typescript-eslint/no-explicit-any */
import { Address, Transaction } from '@opcat-labs/opcat';
import {
  FixedArray,
} from '../smart-contract/types/index.js';
import * as tools from 'uint8array-tools';

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



/** @ignore */
export function requireTrue(res: boolean, message: string) {
  if (!res) {
    throw new Error(message);
  }
}

/** @ignore */
export function getTxId(input: Transaction.Input): string {
  return uint8ArrayToHex(input.prevTxId);
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

  if (Buffer.isBuffer(obj)) {
    return Buffer.from(Uint8Array.prototype.slice.call(obj)) as unknown as T;
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

const MAXINT = 0xffffffff; // Math.pow(2, 32) - 1;

export function isFinal(sequenceNumber: number) {
  return sequenceNumber !== MAXINT;
}

export function toHex(val: Buffer | string | Uint8Array): string {
  if (Buffer.isBuffer(val)) {
    return val.toString('hex');
  }
  if (typeof val === 'string') {
    return val;
  }
  return tools.toHex(val);
}

/**
 * Converts a Opcat address to its public key hash (PKH) in hex format.
 * @param address - The Opcat address to convert.
 * @returns The public key hash as a hex string.
 */
export function addrToPkh(address: string) {
  return tools.toHex(Address.fromString(address).hashBuffer);
}