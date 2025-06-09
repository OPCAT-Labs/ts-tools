import { Int32 } from '../types/primitives.js';

/**
 * Returns the maximum of two Int32 values.
 * @category BigInt Operations
 * @onchain
 * @param a - First Int32 value
 * @param b - Second Int32 value
 * @returns {Int32} The larger of the two Int32 values.
 */
export function max(a: Int32, b: Int32): Int32 {
  return a > b ? a : b;
}

/**
 * Returns the minimum of two Int32 values.
 * @category BigInt Operations
 * @onchain
 * @param a - First Int32 value
 * @param b - Second Int32 value
 * @returns {Int32} The smaller of the two Int32 values.
 */
export function min(a: Int32, b: Int32): Int32 {
  return a < b ? a : b;
}

/**
 * Checks whether a Int32 value is strictly between two other Int32 values.
 * @category BigInt Operations
 * @onchain
 * @param value - The Int32 value to check
 * @param lower - The lower bound (exclusive)
 * @param upper - The upper bound (exclusive)
 * @returns {boolean} True if value is strictly between lower and upper, otherwise false.
 */
export function within(value: Int32, lower: Int32, upper: Int32): boolean {
  return value > lower && value < upper;
}

/**
 * Returns the absolute value of a Int32.
 * @category BigInt Operations
 * @onchain
 * @param value - The Int32 value
 * @returns {Int32} The absolute value of the Int32.
 */
export function abs(value: Int32): Int32 {
  return value < 0n ? -value : value;
}
