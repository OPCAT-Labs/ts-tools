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
export const TAPROOT_ONLY_SCRIPT_SPENT_KEY =
  '50929b74c1a04954b78b4b6035e97a5e078a5a0f28ec96d547bfee9ace803ac0';

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

/** @ignore */
export const TX_IO_INDEX_VAL_MIN = 0n;
/** @ignore */
export const TX_IO_INDEX_VAL_MAX = 5n;
/** @ignore the first output, aka the state output, is an OP_RETURN output that carries states of the other outputs. */
export const STATE_OUTPUT_INDEX = 0;
/** @ignore */
export const STATE_OUTPUT_OFFSET = 1;
/** @ignore */
export const STATE_OUTPUT_COUNT_MAX = 5;
/** @ignore */
export const TX_HASH_PREIMAGE2_SUFFIX_ARRAY_SIZE = 4;
/** @ignore */
export const TX_HASH_PREIMAGE3_INPUT_ARRAY_SIZE = 4;
/** @ignore how many different collections can there be in a nftGuard */
export const NFT_GUARD_COLLECTION_TYPE_MAX = 4;
/** @ignore byte length of each part in tx */
export const TX_VERSION_BYTE_LEN = 4n;
/** @ignore */
export const TX_INPUT_COUNT_BYTE_LEN = 1n;
/** @ignore */
export const TX_INPUT_PREV_TX_HASH_BYTE_LEN = TX_HASH_BYTE_LEN;
/** @ignore */
export const TX_INPUT_PREV_OUTPUT_INDEX_BYTE_LEN = 4n;
/** @ignore */
export const TX_INPUT_PREVOUT_BYTE_LEN = 36n;
/** @ignore */
export const TX_SEGWIT_INPUT_SCRIPT_LEN_BYTE_LEN = 1n;
/** @ignore */
export const TX_INPUT_SEQUENCE_BYTE_LEN = 4n;
/** @ignore */
export const TX_SEGWIT_INPUT_BYTE_LEN = 41n;
/** @ignore */
export const TX_OUTPUT_COUNT_BYTE_LEN = 1n;
/** @ignore */
export const TX_OUTPUT_SATOSHI_BYTE_LEN = 8n;
/** @ignore */
export const TX_LOCKTIME_BYTE_LEN = 4n;
/** @ignore byte length of token owner address owned by user*/
export const OWNER_ADDR_P2WPKH_BYTE_LEN = 22n; // p2wpkh locking script
/** @ignore */
/** @ignore  owned by contract */
export const OWNER_ADDR_CONTRACT_HASH_BYTE_LEN = HASH160_HASH_LEN; // contract script hash
/** @ignore the maximum number of flattened fields in a state object. */
export const MAX_FLAT_FIELDS_IN_STATE = 26;
/** @ignore the dust limit is the minimum amount of satoshis that can be sent in a transaction */
export const DUST_LIMIT = 330;
