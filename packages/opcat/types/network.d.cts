export = Network;
/**
 * A network is merely a map containing values that correspond to version
 * numbers for each bitcoin network. Currently only supporting "livenet"
 * (a.k.a. "mainnet"), "testnet", "regtest".
 * @constructor
 * @param {Object} [data] - Network object data
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
 */
declare function Network(data?: {
    name: string;
    alias: string;
    pubkeyhash: number;
    privatekey: number;
    scripthash: number;
    xpubkey: number;
    xprivkey: number;
    networkMagic: number;
    port: number;
    dnsSeeds: Array<string>;
}): void;
declare class Network {
    /**
     * A network is merely a map containing values that correspond to version
     * numbers for each bitcoin network. Currently only supporting "livenet"
     * (a.k.a. "mainnet"), "testnet", "regtest".
     * @constructor
     * @param {Object} [data] - Network object data
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
     */
    constructor(data?: {
        name: string;
        alias: string;
        pubkeyhash: number;
        privatekey: number;
        scripthash: number;
        xpubkey: number;
        xprivkey: number;
        networkMagic: number;
        port: number;
        dnsSeeds: Array<string>;
    });
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
    /**
     * Returns the name of the network as a string.
     * @returns {string} The name of the network.
     */
    toString(): string;
}
