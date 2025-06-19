// https://en.bitcoin.it/wiki/List_of_address_prefixes
// Dogecoin BIP32 is a proposed standard: https://bitcointalk.org/index.php?topic=409731
import * as opcat from '@opcat-labs/opcat'
import { SupportedNetwork } from './globalTypes.js';

/**
 * Converts a Network object to a SupportedNetwork string.
 * 
 * @param network - The network configuration to check
 * @returns The corresponding supported network name ('opcat-mainnet', 'opcat-testnet', or 'opcat-regtest')
 * @throws {Error} If the network configuration is not supported
 */
export const toSupportedNetwork = (network: opcat.Networks.Network): SupportedNetwork => {
  if (network === opcat.Networks.livenet) {
    return 'opcat-mainnet'
  } else if (network === opcat.Networks.testnet) {
    return 'opcat-testnet'
  } else if (network === opcat.Networks.regtest) {
    return 'opcat-regtest'
  }

  throw new Error('Unsupported network configuration');
}


/**
 * Converts a supported network string into its corresponding Network object.
 * @param network - The supported network identifier ('opcat-mainnet', 'opcat-testnet', or 'opcat-regtest')
 * @returns The corresponding Network object
 * @throws {Error} When an unsupported network configuration is provided
 */
export const fromSupportedNetwork = (network: SupportedNetwork): opcat.Networks.Network => {
  if (network === 'opcat-mainnet') {
    return opcat.Networks.livenet;
  } else if (network === 'opcat-testnet') {
    return opcat.Networks.testnet;
  } else if (network === 'opcat-regtest') {
    return opcat.Networks.regtest;
  }
  throw new Error('Unsupported network configuration');
}


export type Network = opcat.Networks.Network;