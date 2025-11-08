import { ByteString, FixedArray, TxHashPreimage } from "@opcat-labs/scrypt-ts-opcat"
import { StateHashes } from '../types'
import { GUARD_TOKEN_TYPE_MAX, TX_INPUT_COUNT_MAX } from "../constants";
import { StructObject } from "@opcat-labs/scrypt-ts-opcat";

export type CAT20_AMOUNT = bigint

/**
 * The CAT20 state
 * @category CAT20
 * @onchain
 */
export type CAT20State = {
  // owner address
  ownerAddr: ByteString
  // token amount
  amount: CAT20_AMOUNT
}

/**
 * The CAT20 guard state
 * @category CAT20
 * @onchain
 */
export type CAT20GuardConstState = {
  // scripts of all the different types of tokens in curTx inputs
  // e.g.
  // ['token1Script', 'token2Script', 'fd', 'fc']
  // this means there are two different types of tokens in curTx inputs
  // the default placeholders are TOKEN_SCRIPT_HASH_PLACEHOLDER_FF, TOKEN_SCRIPT_HASH_PLACEHOLDER_FE, TOKEN_SCRIPT_HASH_PLACEHOLDER_FD, and TOKEN_SCRIPT_HASH_PLACEHOLDER_FC to ensure the uniqueness of token scripts
  tokenScriptHashes: FixedArray<ByteString, typeof GUARD_TOKEN_TYPE_MAX>

  // total number of tokens for each type of token in curTx inputs
  // e.g.
  // [100, 200, 0, 0]
  // this means there are a total of 100 token1 and 200 token2 in curTx inputs
  tokenAmounts: FixedArray<CAT20_AMOUNT, typeof GUARD_TOKEN_TYPE_MAX>
  // total number of tokens to be burned for each type of token in curTx
  // e.g.
  // [0, 50, 0, 0]
  // this means 50 token2 will be burned in curTx
  tokenBurnAmounts: FixedArray<CAT20_AMOUNT, typeof GUARD_TOKEN_TYPE_MAX>

  // for each input of curTx
  // if the input is a token, the value marks the index of the token script in the tokenScriptHashes array
  // otherwise, the value is -1 by default
  // e.g.
  // [-1, 0, 1, 1, 0, -1]
  // this means
  // the input #0 and #5 is not a token contract
  // the input #1 and #4 is a token contract with script tokenScripts[0] = 'token1Script'
  // the input #2 and #3 is a token contract with script tokenScripts[1] = 'token2Script'
  // each index occupys 1 byte
  tokenScriptIndexes: ByteString
}

/**
 * The CAT20 metadata
 * @category CAT20
 * @category Metadata
 */
export interface CAT20Metadata extends StructObject {
  // name of the token, length is 1~int8.max bytes
  name: ByteString
  // symbol of the token, length is 1~int8.max bytes
  symbol: ByteString
  // decimals of the token, length is 1 byte
  decimals: bigint
  // md5 of the token minter contract, length is 16 bytes
  minterMd5: ByteString
}

// todo: transpiler should support this
// export interface ClosedMinterCAT20Meta extends CAT20Metadata {}
// export type ClosedMinterCAT20Meta = CAT20Metadata
/**
 * The CAT20 metadata for closed minter
 * @category CAT20
 * @category Metadata
 */
export interface ClosedMinterCAT20Meta extends StructObject {
  name: ByteString
  symbol: ByteString
  decimals: bigint
  hasAdmin: boolean
  minterMd5: ByteString
}

/**
 * The CAT20 metadata for open minter
 * @category CAT20
 * @category Metadata
 */
export interface OpenMinterCAT20Meta extends StructObject {
  // name of the token, length is 1~int8.max bytes
  name: ByteString
  // symbol of the token, length is 1~int8.max bytes
  symbol: ByteString
  // decimals of the token, length is 1 byte
  decimals: bigint
  hasAdmin: boolean
  // md5 of the token minter contract, length is 16 bytes
  minterMd5: ByteString

  // max supply of the token
  max: CAT20_AMOUNT
  // limit of the token
  limit: CAT20_AMOUNT
  // premine of the token
  premine: CAT20_AMOUNT
  // preminer address of the token, p2pkh locking script hex, empty if premine is 0
  preminerAddr: ByteString
}

/**
 * The CAT20 open minter state
 * @category CAT20
 * @onchain
 */
export interface CAT20OpenMinterState extends StructObject {
  // sha256 of tokenScript
  tokenScriptHash: ByteString
  // first-time mint flag
  hasMintedBefore: boolean
  // remaining mint count
  remainingCount: CAT20_AMOUNT
}

/**
 * The CAT20 closed minter state
 * @category CAT20
 * @onchain
 */
export interface CAT20ClosedMinterState extends StructObject {
  // sha256 of tokenScript
  tokenScriptHash: ByteString
}

/**
 * CAT20Admin state interface.
 *
 * Represents the state of a CAT20 admin contract, which manages administrative
 * privileges for CAT20 tokens. The admin can perform privileged operations such
 * as transferring ownership to another address via the adminSpend method.
 *
 * @property tag - Contract identifier tag
 * @property adminAddress - Address of the current admin owner
 */

export interface CAT20AdminState extends StructObject {
  tag: ByteString
  adminAddress: ByteString
}
