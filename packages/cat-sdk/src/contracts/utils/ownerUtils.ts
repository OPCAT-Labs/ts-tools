import { assert, ByteString, hash160, len, method, SmartContractLib, toByteString } from "@opcat-labs/scrypt-ts-opcat";
import {
    OWNER_ADDR_CONTRACT_HASH_BYTE_LEN,
    OWNER_ADDR_P2PKH_BYTE_LEN,
    PUBKEY_BYTE_LEN,
  } from '../constants'

export class OwnerUtils extends SmartContractLib {
    /**
   * Convert public key to P2PKH locking script
   * @param pubKey user public key
   * @returns locking script
   */
  @method()
  static toLockingScript(pubKey: ByteString): ByteString {
    OwnerUtils.checkPubKey(pubKey)
    return toByteString('76a914') + hash160(pubKey) + toByteString('88ac') // P2PKH
  }

  /**
   * Check if the user public key matches the owner's address
   * @param pubKey user public key
   * @param ownerAddr owner address
   */
  @method()
  static checkUserOwner(pubKey: ByteString, ownerAddr: ByteString): void {
    assert(OwnerUtils.toLockingScript(pubKey) == ownerAddr)
  }

  @method()
  static checkPubKey(pubKey: ByteString): void {
    assert(len(pubKey) == PUBKEY_BYTE_LEN)
  }

  @method()
  static checkOwnerAddr(ownerAddr: ByteString): void {
    const addrLen = len(ownerAddr)
    assert(
      addrLen == OWNER_ADDR_P2PKH_BYTE_LEN || // P2PKH locking script
        addrLen == OWNER_ADDR_CONTRACT_HASH_BYTE_LEN // contract script hash
    )
  }

  @method()
  static serialize(ownerAddr: ByteString): ByteString {
    // todo: confirm address len
    return ownerAddr
  }
}