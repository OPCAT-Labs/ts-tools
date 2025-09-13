import {
  ByteString,
  prop,
  Sha256,
  SmartContractLib,
  toByteString,
} from '@opcat-labs/scrypt-ts-opcat'

export const HASH160_HASH_LEN = 20n
export const SHA256_HASH_LEN = 32n
export const PUBKEY_BYTE_LEN = 33n
export const STATE_HASH_BYTE_LEN = SHA256_HASH_LEN
// byte length of token owner address
// owned by user
export const OWNER_ADDR_P2PKH_BYTE_LEN = 25n // p2pkh locking script
// owned by contract
export const OWNER_ADDR_CONTRACT_HASH_BYTE_LEN = SHA256_HASH_LEN // contract script hash

export const TX_INPUT_COUNT_MAX = 10
export const TX_OUTPUT_COUNT_MAX = 10

// how many different tokens can there be in a guard
export const GUARD_TOKEN_TYPE_MAX = 4

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
