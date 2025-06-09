import { cloneDeep } from '../../utils/common.js';
import { FixedArray } from '../types/index.js';

/**
 * Returns an `FixedArray` with all `size` elements set to `value`, where `value` can be any type.
 * Note that `length` must be a numeric literal or a compiled-time constant
 * @category Global Function
 * @onchain
 * @param value - the value of each element to set
 * @param length - the length of FixedArray
 */
export function fill<E, N extends number>(value: E, length: N): FixedArray<E, N> {
  return Array(length)
    .fill(0)
    .map((_) => cloneDeep(value)) as FixedArray<E, N>;
}
