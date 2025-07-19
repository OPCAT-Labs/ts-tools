import { ByteString, sha256, toByteString } from '@opcat-labs/scrypt-ts-opcat'

export const SIGNATURE_LEN = 64
export const DUMMY_SIGNATURE = '00'.repeat(SIGNATURE_LEN)

export const PUBLIC_KEY_LEN = 33
export const DUMMY_PUBLIC_KEY =
  '02c8d548b9a584bf74c2aa179f4809a4b8d69641fd8aac0f3b6ebda24ec91ac722'

export type InputIndex = number
export type SupportedNetwork = 'livenet' | 'testnet'

export const SHA256_EMPTY_STRING = toByteString(sha256(''))

export enum Postage {
  METADATA_POSTAGE = 546,
  GUARD_POSTAGE = 332,
  MINTER_POSTAGE = 331,
  TOKEN_POSTAGE = 330,
  NFT_POSTAGE = 333,
}

/**
 * The structure used to refer to a particular transaction output
 * @category Types
 * @onchain
 */
export type Outpoint = {
  /**
   * The transaction hash, which is the reverse order of bytes of the `txId`.
   */
  txHash: ByteString

  /**
   * The index of the output in the transaction.
   */
  outputIndex: ByteString
}
