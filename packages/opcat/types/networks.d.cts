export = Networks;
/**
 * A tool class for managing all supported networks
 * @constructor
 */
declare function Networks(): void;
declare namespace Networks {
    /**
     * @function
     * @member Networks#get
     * Retrieves the network associated with a magic number or string.
     * @param {string|number|Network} arg
     * @param {string|Array.<string>} [keys] - if set, only check if the magic number associated with this name matches
     * @return {Network|undefined} The network object associated with the input argument, or undefined if not found.
     */
    export function get(arg: string | number | Network, keys?: string | string[]): Network;
    /**
     * Adds a new network configuration to the networks list.
     * @member Networks#add
     * Will add a custom Network
     * @param {Object} data
     * @param {string} data.name - The name of the network
     * @param {string} data.alias - The aliased name of the network
     * @param {Number} data.pubkeyhash - The publickey hash cashAddrPrefix
     * @param {Number} data.privatekey - The privatekey cashAddrPrefix
     * @param {Number} data.scripthash - The scripthash cashAddrPrefix
     * @param {Number} data.xpubkey - The extended public key magic
     * @param {Number} data.xprivkey - The extended private key magic
     * @param {Number} data.networkMagic - The network magic number
     * @param {Number} data.port - The network port
     * @param {Array.<string>}  data.dnsSeeds - An array of dns seeds
     * @return {Network} The newly created network object.
     */
    export function add(data: {
        name: string;
        alias: string;
        pubkeyhash: number;
        privatekey: number;
        scripthash: number;
        xpubkey: number;
        xprivkey: number;
        networkMagic: number;
        port: number;
        dnsSeeds: string[];
    }): Network;
    /**
     * @function
     * @member Networks#remove
     * Will remove a custom network
     * @param {Network} network
     */
    export function remove(network: Network): void;
    export { livenet };
    export { regtest };
    export { testnet };
    export { livenet as defaultNetwork };
    /**
     * Enables regtest network mode for testing purposes.
     * @member Networks#enableRegtest
     * @function
     */
    export function enableRegtest(): void;
    /**
     * @function
     * @member Networks#disableRegtest
     * Disables the regtest network configuration.
     * This sets the `regtestEnabled` flag to false in the testnet configuration.
     */
    export function disableRegtest(): void;
}
declare class Networks {
}
import Network = require("./network.cjs");
declare var livenet: Network;
declare var regtest: Network;
declare var testnet: Network;
