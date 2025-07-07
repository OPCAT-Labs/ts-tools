import { assert } from "console";

/**
 * `exit(bool status)`; statement terminates contract execution.
 * @category Global Function
 * @onchain
 * @param status - If status is true, contract succeeds; otherwise, it fails.
 *
 */
export function exit(status: boolean): void {
    assert(status, 'exit failed')
}