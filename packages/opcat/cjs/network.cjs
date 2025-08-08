var JSUtil = require('./util/js.cjs');

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
function Network(data) {
    if (typeof data === 'object') {
        this.name = data.name;
        this.alias = data.alias;
        this.pubkeyhash = data.pubkeyhash;
        this.privatekey = data.privatekey;
        this.scripthash = data.scripthash;
        this.xpubkey = data.xpubkey;
        this.xprivkey = data.xprivkey;
        this.networkMagic = data.networkMagic;
        this.port = data.port;
        this.dnsSeeds = data.dnsSeeds;

        JSUtil.defineImmutable(this, {
            name: data.name,
            alias: data.alias,
            pubkeyhash: data.pubkeyhash,
            privatekey: data.privatekey,
            scripthash: data.scripthash,
            xpubkey: data.xpubkey,
            xprivkey: data.xprivkey,
        });
    }
}

/**
 * Returns the name of the network as a string.
 * @returns {string} The name of the network.
 */
Network.prototype.toString = function toString() {
    return this.name;
};

module.exports = Network