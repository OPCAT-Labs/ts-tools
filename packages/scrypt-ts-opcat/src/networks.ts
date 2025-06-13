// https://en.bitcoin.it/wiki/List_of_address_prefixes
// Dogecoin BIP32 is a proposed standard: https://bitcointalk.org/index.php?topic=409731
import * as opcat from '@opcat-labs/opcat'
import { SupportedNetwork } from './globalTypes.js';

/**
 * Converts a Network object to a SupportedNetwork string.
 * 
 * @param network - The network configuration to check
 * @returns The corresponding supported network name ('fractal-mainnet', 'fractal-testnet', or 'fractal-regtest')
 * @throws {Error} If the network configuration is not supported
 */
export const toSupportedNetwork = (network: opcat.Networks.Network): SupportedNetwork => {
  if (network === opcat.Networks.livenet) {
    return 'fractal-mainnet'
  } else if (network === opcat.Networks.testnet) {
    return 'fractal-testnet'
  } else if (network === opcat.Networks.regtest) {
    return 'fractal-regtest'
  }

  throw new Error('Unsupported network configuration');
}


/**
 * Converts a supported network string into its corresponding Network object.
 * @param network - The supported network identifier ('fractal-mainnet', 'fractal-testnet', or 'fractal-regtest')
 * @returns The corresponding Network object
 * @throws {Error} When an unsupported network configuration is provided
 */
export const fromSupportedNetwork = (network: SupportedNetwork): opcat.Networks.Network => {
  if (network === 'fractal-mainnet') {
    return opcat.Networks.livenet;
  } else if (network === 'fractal-testnet') {
    return opcat.Networks.testnet;
  } else if (network === 'fractal-regtest') {
    return opcat.Networks.regtest;
  }
  throw new Error('Unsupported network configuration');
}


export type Network = opcat.Networks.Network;