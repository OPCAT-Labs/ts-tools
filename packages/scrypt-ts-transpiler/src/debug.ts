import ts, { SortedReadonlyArray, SortedArray } from 'typescript';

export const enum Comparison {
  LessThan = -1,
  EqualTo = 0,
  GreaterThan = 1,
}

export type Comparer<T> = (a: T, b: T) => Comparison;

const enumMemberCache = new Map<object, SortedReadonlyArray<[number, string]>>();

function selectIndex(_: unknown, i: number) {
  return i;
}

export function indicesOf(array: readonly unknown[]): number[] {
  return array.map(selectIndex);
}

function stableSortIndices<T>(array: readonly T[], indices: number[], comparer: Comparer<T>) {
  // sort indices by value then position
  indices.sort((x, y) => comparer(array[x], array[y]) || compareValues(x, y));
}

/**
 * Stable sort of an array. Elements equal to each other maintain their relative position in the array.
 *
 * @internal
 */
export function stableSort<T>(array: readonly T[], comparer: Comparer<T>): SortedReadonlyArray<T> {
  const indices = indicesOf(array);
  stableSortIndices(array, indices, comparer);
  return indices.map((i) => array[i]) as SortedArray<T> as SortedReadonlyArray<T>;
}

function compareComparableValues(a: string | undefined, b: string | undefined): Comparison;
function compareComparableValues(a: number | undefined, b: number | undefined): Comparison;
function compareComparableValues(a: string | number | undefined, b: string | number | undefined) {
  return a === b
    ? Comparison.EqualTo
    : a === undefined
      ? Comparison.LessThan
      : b === undefined
        ? Comparison.GreaterThan
        : a < b
          ? Comparison.LessThan
          : Comparison.GreaterThan;
}

/**
 * Compare two numeric values for their order relative to each other.
 * To compare strings, use any of the `compareStrings` functions.
 *
 * @internal
 */
export function compareValues(a: number | undefined, b: number | undefined): Comparison {
  return compareComparableValues(a, b);
}

function getEnumMembers(enumObject: object) {
  // Assuming enum objects do not change at runtime, we can cache the enum members list
  // to reuse later. This saves us from reconstructing this each and every time we call
  // a formatting function (which can be expensive for large enums like SyntaxKind).
  const existing = enumMemberCache.get(enumObject);
  if (existing) {
    return existing;
  }

  const result: [number, string][] = [];
  for (const name in enumObject) {
    const value = enumObject[name];
    if (typeof value === 'number') {
      result.push([value, name]);
    }
  }

  const sorted = stableSort<[number, string]>(result, (x, y) => compareValues(x[0], y[0]));
  enumMemberCache.set(enumObject, sorted);
  return sorted;
}

export function formatEnum(value = 0, enumObject: object, isFlags?: boolean) {
  const members = getEnumMembers(enumObject);
  if (value === 0) {
    return members.length > 0 && members[0][0] === 0 ? members[0][1] : '0';
  }
  if (isFlags) {
    const result: string[] = [];
    let remainingFlags = value;
    for (const [enumValue, enumName] of members) {
      if (enumValue > value) {
        break;
      }
      if (enumValue !== 0 && enumValue & value) {
        result.push(enumName);
        remainingFlags &= ~enumValue;
      }
    }
    if (remainingFlags === 0) {
      return result.join('|');
    }
  } else {
    for (const [enumValue, enumName] of members) {
      if (enumValue === value) {
        return enumName;
      }
    }
  }
  return value.toString();
}

export function formatTypeFlags(flags: ts.TypeFlags | undefined): string {
  return formatEnum(flags, ts.TypeFlags, /*isFlags*/ true);
}

export function formatObjectFlags(flags: ts.ObjectFlags | undefined): string {
  return formatEnum(flags, ts.ObjectFlags, /*isFlags*/ true);
}
