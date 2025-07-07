/**
 * `assert(condition: boolean, errorMsg?: string)`
 * Throw an Error with the optional error message if condition is false. Otherwise, nothing happens.
 * @onchain
 * @category Global Functions
 */
export function assert(condition: boolean, msg?: string): asserts condition {
  if (!condition) {
    const message = 'Execution failed' + (msg ? `, ${msg}` : '');
    throw new Error(message);
  }
}
