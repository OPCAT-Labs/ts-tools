export = PrivateKey;
/**
 * Instantiate a PrivateKey from a BN, Buffer or WIF string.
 *
 * @param {string|BN|Buffer|{bn: string, compressed: boolean, network: string}} data - The encoded data in various formats
 * @param {Network|string} [network] - a {@link Network} object, or a string with the network name
 * @returns {PrivateKey} A new valid instance of an PrivateKey
 * @constructor
 */
declare function PrivateKey(data: string | BN | Buffer | {
    bn: string;
    compressed: boolean;
    network: string;
}, network?: Network | string): PrivateKey;
declare class PrivateKey {
    /**
     * Instantiate a PrivateKey from a BN, Buffer or WIF string.
     *
     * @param {string|BN|Buffer|{bn: string, compressed: boolean, network: string}} data - The encoded data in various formats
     * @param {Network|string} [network] - a {@link Network} object, or a string with the network name
     * @returns {PrivateKey} A new valid instance of an PrivateKey
     * @constructor
     */
    constructor(data: string | BN | Buffer | {
        bn: string;
        compressed: boolean;
        network: string;
    }, network?: Network | string);
    bn: BN;
    network: Network;
    compressed: boolean;
    get publicKey(): PublicKey;
    private _classifyArguments;
    /**
     * Will output the PrivateKey in WIF
     *
     * @returns {string}
     */
    toString(): string;
    /**
     * Will output the PrivateKey to a WIF string
     *
     * @returns {string} A WIP representation of the private key
     */
    toWIF(): string;
    /**
     * Will return the private key as a BN instance
     *
     * @returns {BN} A BN instance of the private key
     */
    toBigNumber(): BN;
    /**
     * Will return the private key as a BN buffer
     *
     * @returns {Buffer} A buffer of the private key
     */
    toBuffer(): Buffer;
    /**
     * Converts the private key to a hexadecimal string representation.
     * @returns {string} Hexadecimal string of the private key.
     */
    toHex(): string;
    /**
     * Will return the corresponding public key
     *
     * @returns {PublicKey} A public key generated from the private key
     */
    toPublicKey(): PublicKey;
    _pubkey: {
        point: Point;
        compressed?: boolean;
        network?: string | Network;
    };
    /**
     * Will return an address for the private key
     * @param {Network|string} [network] - optional parameter specifying
     * the desired network for the address
     *
     * @returns {Address} An address generated from the private key
     */
    toAddress(network?: Network | string): Address;
    /**
     * @returns {{bn: string, compressed: boolean, network: string}} A plain object representation
     */
    toObject: () => {
        bn: string;
        compressed: boolean;
        network: string;
    };
    toJSON(): {
        bn: string;
        compressed: boolean;
        network: string;
    };
    /**
     * Will return a string formatted for the console
     *
     * @returns {string} Private key
     */
    inspect(): string;
}
declare namespace PrivateKey {
    /**
     * Internal function to get a random Big Number (BN)
     *
     * @returns {BN} A new randomly generated BN
     * @private
     */
    function _getRandomBN(): BN;
    /**
     * Internal function to transform a WIF Buffer into a private key
     *
     * @param {Buffer} buf - An WIF string
     * @param {Network|string} [network] - a {@link Network} object, or a string with the network name
     * @returns {{bn: BN, network: Network, compressed: boolean}} An object with keys: bn, network and compressed
     * @private
     */
    function _transformBuffer(buf: Buffer, network?: string | Network): {
        bn: BN;
        network: Network;
        compressed: boolean;
    };
    /**
     * Internal function to transform a BN buffer into a private key
     *
     * @param {Buffer} buf
     * @param {Network|string=} network - a {@link Network} object, or a string with the network name
     * @returns {{bn: BN, network: Network, compressed: boolean}} an Object with keys: bn, network, and compressed
     * @private
     */
    function _transformBNBuffer(buf: Buffer, network?: string | Network): {
        bn: BN;
        network: Network;
        compressed: boolean;
    };
    /**
     * Internal function to transform a WIF string into a private key
     *
     * @param {string} wif - An WIF string
     * @param {Network|string} [network] - a {@link Network} object, or a string with the network name
     * @returns {{bn: BN, network: Network, compressed: boolean}} An object with keys: bn, network and compressed
     * @private
     */
    function _transformWIF(wif: string, network?: string | Network): {
        bn: BN;
        network: Network;
        compressed: boolean;
    };
    /**
     * Instantiate a PrivateKey from a Buffer with the DER or WIF representation
     *
     * @param {Buffer} buf - A private key string
     * @param {Network} [network] - A Bitcoin network
     * @return {PrivateKey} A new instance of PrivateKey
     */
    function fromBuffer(buf: Buffer, network?: Network): PrivateKey;
    /**
     * Creates a PrivateKey instance from a hexadecimal string.
     * @param {string} hex - The hexadecimal string representation of the private key.
     * @param {Network} network - The network associated with the private key.
     * @returns {PrivateKey} A PrivateKey instance.
     */
    function fromHex(hex: string, network: Network): PrivateKey;
    /**
     * Internal function to transform a JSON string on plain object into a private key
     * return this.
     *
     * @param {Object} json - A JSON string or plain object
     * @param {string} json.bn - The private key in hexadecimal format
     * @param {string|Network} json.network - The network associated with the private keyname or alias
     * @param {boolean} [json.compressed] - The private key's compressed state
     * @returns {{bn: BN, network: Network, compressed: boolean}} An object with keys: bn, network and compressed
     * @private
     */
    function _transformObject(json: {
        bn: string;
        network: string | Network;
        compressed?: boolean;
    }): {
        bn: BN;
        network: Network;
        compressed: boolean;
    };
    function fromString(str: string): PrivateKey;
    function fromWIF(str: string): PrivateKey;
    function fromObject(obj: {
        bn: string;
        compressed: boolean;
        network: string;
    }): PrivateKey;
    function fromJSON(obj: {
        bn: string;
        compressed: boolean;
        network: string;
    }): PrivateKey;
    /**
     * Instantiate a PrivateKey from random bytes
     *
     * @param {string|Network} [network] - Either "livenet" or "testnet"
     * @returns {PrivateKey} A new valid instance of PrivateKey
     */
    function fromRandom(network?: string | Network): PrivateKey;
    /**
     * Check if there would be any errors when initializing a PrivateKey
     *
     * @param {string} data - The encoded data in various formats
     * @param {string|Network} [network] - Either "livenet" or "testnet"
     * @returns {null|Error} An error if exists
     */
    function getValidationError(data: string, network?: string | Network): Error;
    /**
     * Check if the parameters are valid
     *
     * @param {string} data - The encoded data in various formats
     * @param {string|Network} [network] - Either "livenet" or "testnet"
     * @returns {Boolean} If the private key is would be valid
     */
    function isValid(data: string, network?: string | Network): boolean;
}
import BN = require("./bn.cjs");
import Network = require("./network.cjs");
import PublicKey = require("./publickey.cjs");
import Point = require("./crypto/point.cjs");
import Address = require("./address.cjs");
