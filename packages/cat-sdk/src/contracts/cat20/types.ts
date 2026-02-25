import { ByteString, FixedArray } from "@opcat-labs/scrypt-ts-opcat"
import { GUARD_TOKEN_TYPE_MAX } from "../constants.js";
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
  /**
   * The address of the deployer who created this Guard UTXO.
   * Used to authorize the `unlock` method, preventing other users from using this guard.
   * Format: P2PKH locking script (76a914 + hash160(pubKey) + 88ac)
   * @note F14 Fix: Added to prevent guard reuse by unauthorized users
   */
  deployerAddr: ByteString
  // scripts of all the different types of tokens in curTx inputs
  // e.g.
  // ['token1Script', 'token2Script', 'fd', 'fc']
  // this means there are two different types of tokens in curTx inputs
  // the default placeholders are TOKEN_SCRIPT_HASH_PLACEHOLDER_FF, TOKEN_SCRIPT_HASH_PLACEHOLDER_FE, TOKEN_SCRIPT_HASH_PLACEHOLDER_FD, and TOKEN_SCRIPT_HASH_PLACEHOLDER_FC to ensure the uniqueness of token scripts
  tokenScriptHashes: FixedArray<ByteString, typeof GUARD_TOKEN_TYPE_MAX>

  // for each input of curTx
  /**
   * Maps each transaction input to its token type index in tokenScriptHashes array
   * - For token inputs: contains the index (0-3) of the token type in tokenScriptHashes
   * - For non-token inputs: contains -1 (0xFF in ByteString)
   * - Each index occupies 1 byte
   *
   * @example
   * Given tokenScriptIndexes = "810001010081" (hex representation of [-1, 0, 1, 1, 0, -1]):
   * - Input #0: non-token (0x81 = -1)
   * - Input #1: token type 0 (tokenScriptHashes[0])
   * - Input #2: token type 1 (tokenScriptHashes[1])
   * - Input #3: token type 1 (tokenScriptHashes[1])
   * - Input #4: token type 0 (tokenScriptHashes[0])
   * - Input #5: non-token (0x81 = -1)
   */
  tokenScriptIndexes: ByteString
}

/**
 * The CAT20 metadata
 * @category CAT20
 * @category Metadata
 */
export interface CAT20Metadata {
  // name of the token
  name: ByteString
  // symbol of the token
  symbol: ByteString
  // decimals of the token
  decimals: bigint
  // whether the token has admin
  hasAdmin: boolean
  // icon
  icon?: {
    type: ByteString
    body: ByteString
  }
}


// todo: transpiler should support this
// export interface ClosedMinterCAT20Meta extends CAT20Metadata {}
// export type ClosedMinterCAT20Meta = CAT20Metadata
/**
 * The CAT20 metadata for closed minter
 * @category CAT20
 * @category Metadata
 */
export type ClosedMinterCAT20Meta = CAT20Metadata

/**
 * The CAT20 metadata for open minter
 * @category CAT20
 * @category Metadata
 */
export interface OpenMinterCAT20Meta extends CAT20Metadata {
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
