import {
  ByteString,
  FixedArray,
  PubKey,
  Sig,
} from '@opcat-labs/scrypt-ts-opcat'
import { TX_OUTPUT_COUNT_MAX } from './constants'

export const SPEND_TYPE_USER_SPEND = 0n
export const SPEND_TYPE_CONTRACT_SPEND = 1n
export const SPEND_TYPE_ADMIN_SPEND = 2n

// args to unlock a token UTXO or a nft UTXO
export type ContractUnlockArgs = {
  // 0 userSpend, 1 contractSpend, 2 adminSpend
  spendType: bigint
  // user spend args
  userPubKey: PubKey
  userSig: Sig
  // default to -1n
  spendScriptInputIndex: bigint
}

export type StateHashes = FixedArray<ByteString, typeof TX_OUTPUT_COUNT_MAX>
