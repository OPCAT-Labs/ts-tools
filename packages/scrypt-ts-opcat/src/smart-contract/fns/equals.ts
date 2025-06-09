/**
 * Comparing two struct/FixedArray
 * @returns {boolean} returns true if equal; otherwise returns false
 * @category Global Function
 * @onchain
 */
export function equals<T>(a: T, b: T): boolean {
  if (Array.isArray(a) && Array.isArray(b)) {
    return equalsArray(a, b);
  }

  if (typeof a === 'object' && typeof b === 'object') {
    return equalsStruct(a, b);
  }

  return a === b;
}

function equalsArray<T>(a: Array<T>, b: Array<T>): boolean {
  if (Array.isArray(a[0])) {
    const results: boolean[] = [];

    for (let i = 0; i < a.length; i++) {
      results.push(equals(a[i], b[i]));
    }

    for (let i = 0; i < results.length; i++) {
      if (!results[i]) {
        return false;
      }
    }

    return true;
  }

  if (a.length !== b.length) {
    return false;
  }

  for (let i = 0; i < a.length; i++) {
    if (!equals(a[i], b[i])) {
      return false;
    }
  }

  return true;
}

function equalsStruct<T>(a: T, b: T): boolean {
  if (typeof a !== 'object' || typeof b !== 'object') {
    return false;
  }

  if (a === null || b === null) {
    return false;
  }

  const akeys = Object.keys(a as object);

  const bkeys = Object.keys(b as object);

  if (akeys.length !== bkeys.length) {
    return false;
  }

  const results: boolean[] = [];

  for (let i = 0; i < akeys.length; i++) {
    results.push(equals(a[akeys[i]], b[bkeys[i]]));
  }

  for (let i = 0; i < results.length; i++) {
    if (!results[i]) {
      return false;
    }
  }

  return true;
}
