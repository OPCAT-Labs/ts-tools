/**
 * @ignore
 * Because of bvm stack max element size is 520, witness tx calculate txid data need less than 520.
 * so max input number is 6, and output number is 6.
 * version 4
 * inputNumber 1
 * input (32 + 4 + 1 + 4) * inputNumber
 * outputNumber 1
 * output (8 + 1 + 34(p2tr script size)) * outputNumber
 * nLocktime 4
 * (520 - (4 + 1 + 1 + 4)) / (41 + 43) = 6.07
 */

/**
 * @ignore
 */
export const SHA256_HASH_LEN = 32n;
/** @ignore */
export const HASH256_HASH_LEN = SHA256_HASH_LEN;
/** @ignore */
export const TX_HASH_BYTE_LEN = HASH256_HASH_LEN;
/** @ignore */
export const RIPEMD160_HASH_LEN = 20n;
/** @ignore */
export const HASH160_HASH_LEN = RIPEMD160_HASH_LEN;
/** @ignore */
export const TX_OUTPUT_SCRIPT_HASH_LEN = SHA256_HASH_LEN;
/** @ignore */
export const TX_OUTPUT_DATA_HASH_LEN = SHA256_HASH_LEN;
/** @ignore
 * prevout (32 + 4) + unlockScriptHash(32) + sequence(4) = 72 
 */
export const TX_INPUT_BYTE_LEN = 72n;
/** @ignore
 * satoshis(8) + scriptHash(32) + dataHash(32) = 72
 */
export const TX_OUTPUT_BYTE_LEN = 72n;
/** @ignore */
export const TX_INPUT_SCRIPT_HASH_BYTE_LEN = 32n;
/** @ignore byte length of each part in tx */
export const TX_VERSION_BYTE_LEN = 4n;
/** @ignore */
export const TX_INPUT_PREV_TX_HASH_BYTE_LEN = TX_HASH_BYTE_LEN;
/** @ignore */
export const TX_OUTPUT_SATOSHI_BYTE_LEN = 8n;
/** 
 * @ignore the maximum number of flattened fields in a state object. 
 * because the hashes of the fields are connected on the stack, so the max length is 520 / 20 = 26.
 * 520 is the max stack size of bvm.
 */
export const MAX_FLAT_FIELDS_IN_STATE = 26;
/** @ignore the dust limit is the minimum amount of satoshis that can be sent in a transaction */
export const DUST_LIMIT = 330;
