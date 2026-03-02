import {
  ByteString,
  FixedArray,
  PubKey,
  Sig,
} from '@opcat-labs/scrypt-ts-opcat'
import { TX_OUTPUT_COUNT_MAX } from './constants.js'

/**
 * The arguments to unlock a token UTXO
 * @category Types
 * @onchain
 */
export type CAT20ContractUnlockArgs = {
  // 0 userSpend, 1 contractSpend, 2 adminSpend
  spendType: bigint
  // user spend args
  userPubKey: PubKey
  userSig: Sig
  // default to -1n
  spendScriptInputIndex: bigint
}

/**
 * The arguments to unlock a nft UTXO
 * @category Types
 * @onchain
 */
export type CAT721ContractUnlockArgs = {
  // user spend args
  userPubKey: PubKey
  userSig: Sig
  // default to -1n
  contractInputIndex: bigint
}

/**
 * The state hashes for the CAT contracts
 * @category Contract
 * @category Types
 * @onchain
 */
export type StateHashes = FixedArray<ByteString, typeof TX_OUTPUT_COUNT_MAX>
