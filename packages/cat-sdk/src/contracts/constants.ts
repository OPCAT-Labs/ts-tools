import { ByteString, prop, Sha256, SmartContractLib, toByteString } from "@opcat-labs/scrypt-ts-opcat"


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
export const TX_INPUT_COUNT_MAX = 10
/**
 * The maximum number of outputs in a transaction
 * @category Constants
 * @onchain
 */
export const TX_OUTPUT_COUNT_MAX = 10

/**
 * The maximum number of different tokens in a guard
 * @category Constants
 * @onchain
 */
export const GUARD_TOKEN_TYPE_MAX = 4

/**
 * The maximum number of different nft collections in a guard
 * @category Constants
 * @onchain
 */
export const NFT_GUARD_COLLECTION_TYPE_MAX = 4

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


    // @prop()
    // static readonly _OPCAT_TAG: ByteString = toByteString('6f70636174'); // 'opcat'
    // @prop()
    // static readonly _OPCAT_VERSION: ByteString = toByteString('01');
    // @prop()
    // static readonly _OPCAT_CAT20_METADATA_SUB_TAG: ByteString = toByteString('00')
    // @prop()
    // static readonly _OPCAT_CAT20_MINTER_SUB_TAG: ByteString = toByteString('01')
    // @prop()
    // static readonly _OPCAT_CAT20_SUB_TAG: ByteString = toByteString('02')
    // @prop()
    // static readonly _OPCAT_CAT721_METADATA_SUB_TAG: ByteString = toByteString('03')
    // @prop()
    // static readonly _OPCAT_CAT721_MINTER_SUB_TAG: ByteString = toByteString('04')
    // @prop()
    // static readonly _OPCAT_CAT721_SUB_TAG: ByteString = toByteString('05')

    // _OPCAT_TAG + _OPCAT_VERSION + _OPCAT_CAT20_METADATA_SUB_TAG
    @prop()
    static readonly OPCAT_CAT20_METADATA_TAG: ByteString = toByteString('6f706361740100')
    // _OPCAT_TAG + _OPCAT_VERSION + _OPCAT_CAT20_MINTER_SUB_TAG
    @prop()
    static readonly OPCAT_CAT20_MINTER_TAG: ByteString = toByteString('6f706361740101')
    // _OPCAT_TAG + _OPCAT_VERSION + _OPCAT_CAT20_SUB_TAG
    @prop()
    static readonly OPCAT_CAT20_TAG: ByteString = toByteString('6f706361740102')

    // _OPCAT_TAG + _OPCAT_VERSION + _OPCAT_CAT721_METADATA_SUB_TAG
    @prop()
    static readonly OPCAT_CAT721_METADATA_TAG: ByteString = toByteString('6f706361740103')
    // _OPCAT_TAG + _OPCAT_VERSION + _OPCAT_CAT721_MINTER_SUB_TAG
    @prop()
    static readonly OPCAT_CAT721_MINTER_TAG: ByteString = toByteString('6f706361740104')
    // _OPCAT_TAG + _OPCAT_VERSION + _OPCAT_CAT721_SUB_TAG
    @prop()
    static readonly OPCAT_CAT721_TAG: ByteString = toByteString('6f706361740105')
  }
  