import { Int32 } from '../types/primitives.js';
import { assert } from "./assert.js";
import { byteStringToInt, intToByteString } from './byteString.js';
import * as tools from 'uint8array-tools';



function simplePow(x: bigint, y: bigint) {
  let calced = 1n;
  for (let i = 0, e = y; i < e; i++) {
    calced *= x
  }
  return calced;
}


function pow2(n: bigint): bigint {
  return simplePow(2n, n);
};

/**
* Arithmetic left shift, returns `x * 2^n`. 
* More detail about [Bitwise Operations]{@link https://docs.opcatlabs.io/how-to-write-a-contract/built-ins#bitwise-operator} 
* @category Bitwise Operations
*/
export function lshift(x: bigint, n: bigint): bigint {
  assert(n >= 0, 'n < 0');
  return x * pow2(n);
}

/**
* Arithmetic right shift, returns `x / 2^n`.
* More detail about [Bitwise Operations]{@link https://docs.opcatlabs.io/how-to-write-a-contract/built-ins#bitwise-operator} 
* @category Bitwise Operations
*/
export function rshift(x: bigint, n: bigint): bigint {
  assert(n >= 0, 'n < 0');
  const ret = x / pow2(n);
  return n == 0n ? x : (x % 2n == -1n ? (ret - 1n) : (x < 0n && ret == 0n) ? -1n : ret);
}



/**
 * Inverts the bits of an Int value.
 * If the input value is 0n, it returns 0n directly.
 * @category Bitwise Operations
 * @onchain
 * @param a - The Int value to be inverted.
 * @returns {Int32} The inverted Int value.
 */

export function invert(a: Int32): Int32 {
  if (a === 0n) {
    return a;
  }

  const buffer = tools.fromHex(intToByteString(a));

  for (let i = 0; i < buffer.length; i++) {
    buffer[i] = ~buffer[i];
  }

  return byteStringToInt(tools.toHex(buffer));
}

/**
 * Performs a bitwise AND operation between two Int values.
 * @category Bitwise Operations
 * @onchain
 * @param a - First integer value
 * @param b - Second integer value
 * @returns Result of bitwise AND operation as Int
 */
export function and(a: Int32, b: Int32): Int32 {
  const size1 = intToByteString(a).length / 2;
  const size2 = intToByteString(b).length / 2;
  const maxSize = BigInt(Math.max(size1, size2));

  const ba = tools.fromHex(intToByteString(a, maxSize));
  const bb = tools.fromHex(intToByteString(b, maxSize));

  for (let i = 0; i < ba.length; i++) {
    ba[i] &= bb[i];
  }
  return byteStringToInt(tools.toHex(ba));
}




/**
 * Performs a bitwise OR operation on two Int values.
 * @category Bitwise Operations
 * @onchain
 * @param a - First integer value
 * @param b - Second integer value
 * @returns Result of bitwise OR operation as Int
 */
export function or(a: Int32, b: Int32): Int32 {
  const size1 = intToByteString(a).length / 2;
  const size2 = intToByteString(b).length / 2;
  const maxSize = BigInt(Math.max(size1, size2));

  const ba = tools.fromHex(intToByteString(a, maxSize));
  const bb = tools.fromHex(intToByteString(b, maxSize));

  for (let i = 0; i < ba.length; i++) {
    ba[i] |= bb[i];
  }

  return byteStringToInt(tools.toHex(ba));

}

/**
 * Performs a bitwise XOR operation on two Int values.
 * @category Bitwise Operations
 * @onchain
 * @param a First integer value
 * @param b Second integer value
 * @returns Result of the XOR operation as an Int
 */
export function xor(a: Int32, b: Int32): Int32 {
  const size1 = intToByteString(a).length / 2;
  const size2 = intToByteString(b).length / 2;
  const maxSize = BigInt(Math.max(size1, size2));

  const ba = tools.fromHex(intToByteString(a, maxSize));
  const bb = tools.fromHex(intToByteString(b, maxSize));

  for (let i = 0; i < ba.length; i++) {
    ba[i] ^= bb[i];
  }

  return byteStringToInt(tools.toHex(ba));
}