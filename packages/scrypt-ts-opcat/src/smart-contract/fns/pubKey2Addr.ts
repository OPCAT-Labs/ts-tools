import { PubKey, Addr } from '../types/index.js';
import { hash160 } from './hashes.js';

/**
 * Get Addr for PubKey.
 * Under the hood this just wraps the hash160 function.
 * @category Hashing
 * @onchain
 * @param {PubKey} pubkey the public key.
 * @returns {Addr} address for the passed public key.
 */
export function pubKey2Addr(pubkey: PubKey): Addr {
  return hash160(pubkey);
}
