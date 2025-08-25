// https://en.bitcoin.it/wiki/List_of_address_prefixes
// Dogecoin BIP32 is a proposed standard: https://bitcointalk.org/index.php?topic=409731
import { Network, Networks} from '@opcat-labs/opcat'
import { SupportedNetwork } from './globalTypes.js';

/**
 * Converts a Network object to a SupportedNetwork string.
 * 
 * @param network - The network configuration to check
 * @returns The corresponding supported network name ('opcat-mainnet', 'opcat-testnet', or 'opcat-regtest')
 * @throws {Error} If the network configuration is not supported
 */
export const toSupportedNetwork = (network: Network): SupportedNetwork => {
  if (network === Networks.livenet) {
    return 'opcat-mainnet'
  } else if (network === Networks.testnet) {
    return 'opcat-testnet'
  } else if (network === Networks.regtest) {
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
export const fromSupportedNetwork = (network: SupportedNetwork): Network => {
  if (network === 'opcat-mainnet') {
    return Networks.livenet;
  } else if (network === 'opcat-testnet') {
    return Networks.testnet;
  } else if (network === 'opcat-regtest') {
    return Networks.regtest;
  }
  throw new Error('Unsupported network configuration');
}