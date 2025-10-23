import { ByteString, sha256, toByteString } from '@opcat-labs/scrypt-ts-opcat'

/**
 * The length of the signature
 * @category Constants
 */
export const SIGNATURE_LEN = 64
/**
 * The dummy signature
 * @category Constants
 */
export const DUMMY_SIGNATURE = '00'.repeat(SIGNATURE_LEN)
/**
 * The length of the public key
 * @category Constants
 */
export const PUBLIC_KEY_LEN = 33

/**
 * A dummy public key
 * @category Constants
 */
export const DUMMY_PUBLIC_KEY =
  '02c8d548b9a584bf74c2aa179f4809a4b8d69641fd8aac0f3b6ebda24ec91ac722'

export type InputIndex = number
export type SupportedNetwork = 'livenet' | 'testnet'

export const SHA256_EMPTY_STRING = toByteString(sha256(''))

export enum Postage {
  METADATA_POSTAGE = 1,
  GUARD_POSTAGE = 1,
  MINTER_POSTAGE = 1,
  TOKEN_POSTAGE = 1,
  NFT_POSTAGE = 1,
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
