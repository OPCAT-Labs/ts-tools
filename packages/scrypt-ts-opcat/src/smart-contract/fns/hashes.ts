import { crypto } from '@scrypt-inc/bitcoinjs-lib';
import { sha256 as sha256_ } from '@noble/hashes/sha256';
import { ripemd160 as ripemd160_ } from '@noble/hashes/ripemd160';
import { sha1 as sha1_ } from '@noble/hashes/sha1';
import { ByteString, Ripemd160, Sha1, Sha256 } from '../types/index.js';
import { hexToUint8Array, uint8ArrayToHex } from '../../utils/common.js';

/**
 * A RIPEMD160 hash of a SHA256 hash, which is always 160 bits or 20 bytes long.
 * This value is commonly used inside Bitcoin, particularly for Bitcoin
 * addresses.
 *
 * See:
 * https://en.wikipedia.org/wiki/RIPEMD
 * @category Hashing
 * @onchain
 * @param {ByteString} a ByteString Data, a.k.a. pre-image, which can be any size.
 * @returns {Ripemd160} The hash in the form of a string.
 */
export function hash160(a: ByteString): Ripemd160 {
  return uint8ArrayToHex(crypto.hash160(hexToUint8Array(a))) as Ripemd160;
}

/**
 * A SHA256 hash, which is always 256 bits or 32 bytes long.
 *
 * See:
 * https://www.movable-type.co.uk/scripts/sha256.html
 * @category Hashing
 * @onchain
 * @param {ByteString} a ByteString Data, a.k.a. pre-image, which can be any size.
 * @returns {Sha256} The hash in the form of a string.
 */
export function sha256(a: ByteString): Sha256 {
  return uint8ArrayToHex(sha256_(hexToUint8Array(a))) as Sha256;
}

/**
 * A double SHA256 hash, which is always 256 bits or 32 bytes bytes long. This
 * hash function is commonly used inside Bitcoin, particularly for the hash of a
 * block and the hash of a transaction.
 *
 * See:
 * https://www.movable-type.co.uk/scripts/sha256.html
 * @category Hashing
 * @onchain
 * @param {ByteString} a ByteString data, a.k.a. pre-image, which can be any size.
 * @returns {Sha256} The hash in the form of a string.
 */
export function hash256(a: ByteString): Sha256 {
  return uint8ArrayToHex(crypto.hash256(hexToUint8Array(a))) as Sha256;
}

/**
 * A SHA or SHA1 hash, which is always 160 bits or 20 bytes long.
 *
 * See:
 * https://en.wikipedia.org/wiki/SHA-1
 * @category Hashing
 * @onchain
 * @param {ByteString} a ByteString Data, a.k.a. pre-image, which can be any size.
 * @returns {Sha1} The hash in the form of a string.
 */
export function sha1(a: ByteString): Sha1 {
  return Sha1(uint8ArrayToHex(sha1_(hexToUint8Array(a))));
}

/**
 * A RIPEMD160 hash, which is always 160 bits or 20 bytes long.
 * See:
 * https://en.wikipedia.org/wiki/RIPEMD
 * @category Hashing
 * @onchain
 * @param {ByteString} a ByteString Data, a.k.a. pre-image, which can be any size.
 * @returns {Ripemd160} The hash in the form of a ByteString.
 */
export function ripemd160(a: ByteString): Ripemd160 {
  return Ripemd160(uint8ArrayToHex(ripemd160_(hexToUint8Array(a))));
}
