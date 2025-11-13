import {
  ByteString,
  prop,
  Sha256,
  SmartContractLib,
  toByteString,
} from '@opcat-labs/scrypt-ts-opcat'

/**
 * The length of the hash160 hash
 * @category Constants
 * @onchain
 */
export const HASH160_HASH_LEN = 20n
/**
 * The length of the sha256 hash
 * @category Constants
 * @onchain
 */
export const SHA256_HASH_LEN = 32n
/**
 * The length of the pubkey
 * @category Constants
 * @onchain
 */
export const PUBKEY_BYTE_LEN = 33n
/**
 * The length of the state hash
 * @category Constants
 * @onchain
 */
export const STATE_HASH_BYTE_LEN = SHA256_HASH_LEN

/**
 * The length of the owner address for p2pkh locking script
 * @category Constants
 * @onchain
 */
export const OWNER_ADDR_P2PKH_BYTE_LEN = 25n // p2pkh locking script

/**
 * The length of the owner address for contract script hash
 * @category Constants
 * @onchain
 */
export const OWNER_ADDR_CONTRACT_HASH_BYTE_LEN = SHA256_HASH_LEN // contract script hash

/**
 * The maximum number of inputs in a transaction
 * @category Constants
 * @onchain
 */
export const TX_INPUT_COUNT_MAX_6 = 6;
export const TX_INPUT_COUNT_MAX_12 = 12;
export const TX_INPUT_COUNT_MAX = TX_INPUT_COUNT_MAX_12;
/**
 * The maximum number of outputs in a transaction
 * @category Constants
 * @onchain
 */
// export const TX_OUTPUT_COUNT_MAX = 10
export const TX_OUTPUT_COUNT_MAX_6 = 6;
export const TX_OUTPUT_COUNT_MAX_12 = 12;
export const TX_OUTPUT_COUNT_MAX = TX_OUTPUT_COUNT_MAX_12;

/**
 * The maximum number of different tokens in a guard
 * @category Constants
 * @onchain
 */
export const GUARD_TOKEN_TYPE_MAX_2 = 2;
export const GUARD_TOKEN_TYPE_MAX_4 = 4;
export const GUARD_TOKEN_TYPE_MAX = GUARD_TOKEN_TYPE_MAX_4;
export const GUARD_VARIANTS_COUNT = 4;

/**
 * The maximum number of different nft collections in a guard
 * @category Constants
 * @onchain
 */
export const NFT_GUARD_COLLECTION_TYPE_MAX_2 = 2;
export const NFT_GUARD_COLLECTION_TYPE_MAX_4 = 4;
export const NFT_GUARD_COLLECTION_TYPE_MAX = NFT_GUARD_COLLECTION_TYPE_MAX_4;
export const NFT_GUARD_VARIANTS_COUNT = 4;




// txHashPreimage
// output: satoshis(8) + lockingScriptHash(32) + dataHash(32)
export const OUTPUT_LOCKING_SCRIPT_HASH_INDEX = 8n
export const OUTPUT_LOCKING_SCRIPT_HASH_LEN = SHA256_HASH_LEN
export const INPUT_UNLOCKING_SCRIPT_HASH_LEN = SHA256_HASH_LEN
export const OUTPUT_DATA_HASH_INDEX =
  OUTPUT_LOCKING_SCRIPT_HASH_INDEX + OUTPUT_LOCKING_SCRIPT_HASH_LEN
export const OUTPUT_DATA_HASH_LEN = SHA256_HASH_LEN
export const CAT20_AMOUNT_BYTE_LEN = 4n
export const MD5_HASH_LEN = 16n

export const NULL_ADMIN_SCRIPT_HASH = toByteString('')

/**
 * The constants library for the CAT contracts
 * @category Constants
 * @onchain
 */
export class ConstantsLib extends SmartContractLib {
  @prop()
  static readonly ZERO_SHA1256_HASH: ByteString = Sha256(
    toByteString(
      '0000000000000000000000000000000000000000000000000000000000000000'
    )
  )
  @prop()
  static readonly TOKEN_SCRIPT_HASH_PLACEHOLDER_FF: ByteString = Sha256(
    toByteString(
      '00000000000000000000000000000000000000000000000000000000000000ff'
    )
  )
  @prop()
  static readonly TOKEN_SCRIPT_HASH_PLACEHOLDER_FE: ByteString = Sha256(
    toByteString(
      '00000000000000000000000000000000000000000000000000000000000000fe'
    )
  )
  @prop()
  static readonly TOKEN_SCRIPT_HASH_PLACEHOLDER_FD: ByteString = Sha256(
    toByteString(
      '00000000000000000000000000000000000000000000000000000000000000fd'
    )
  )
  @prop()
  static readonly TOKEN_SCRIPT_HASH_PLACEHOLDER_FC: ByteString = Sha256(
    toByteString(
      '00000000000000000000000000000000000000000000000000000000000000fc'
    )
  )

  @prop()
  static readonly _OPCAT_TAG: ByteString = toByteString('6f70636174') // 'opcat'
  @prop()
  static readonly _OPCAT_VERSION: ByteString = toByteString('01')
  @prop()
  static readonly _OPCAT_METADATA_SUB_TAG: ByteString = toByteString('00')
  @prop()
  static readonly _OPCAT_MINTER_SUB_TAG: ByteString = toByteString('01')
  @prop()
  static readonly _OPCAT_CAT20_SUB_TAG: ByteString = toByteString('02')

  // @prop()
  // static readonly OPCAT_METADATA_TAG: ByteString = this.OPCAT_TAG + this.OPCAT_VERSION + this.OPCAT_METADATA_SUB_TAG
  // @prop()
  // static readonly OPCAT_MINTER_TAG: ByteString = this.OPCAT_TAG + this.OPCAT_VERSION + this.OPCAT_MINTER_SUB_TAG
  // @prop()
  // static readonly OPCAT_CAT20_TAG: ByteString = this.OPCAT_TAG + this.OPCAT_VERSION + this.OPCAT_CAT20_SUB_TAG
  @prop()
  static readonly OPCAT_METADATA_TAG: ByteString =
    toByteString('6f706361740100')
  @prop()
  static readonly OPCAT_MINTER_TAG: ByteString = toByteString('6f706361740101')
  @prop()
  static readonly OPCAT_CAT20_TAG: ByteString = toByteString('6f706361740102')
  @prop()
  static readonly OPCAT_CAT20_ADMIN_TAG: ByteString =
    toByteString('6f706361740103')
}
