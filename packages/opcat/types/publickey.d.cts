export = PublicKey;
/**
 * Instantiate a PublicKey from a {@link PrivateKey}, {@link Point}, `string`, or `Buffer`.
 *
 * There are two internal properties, `network` and `compressed`, that deal with importing
 * a PublicKey from a PrivateKey in WIF format. More details described on {@link PrivateKey}
 *
 * @example
 * ```javascript
 * // instantiate from a private key
 * var key = PublicKey(privateKey, true);
 *
 * // export to as a DER hex encoded string
 * var exported = key.toString();
 *
 * // import the public key
 * var imported = PublicKey.fromString(exported);
 * ```
 *
 * @param {string} data - The encoded data in various formats
 * @param {Object} extra - additional options
 * @param {Network|string} extra.network - Which network should the address for this public key be for
 * @param {boolean=} extra.compressed - If the public key is compressed
 * @returns {PublicKey} A new valid instance of an PublicKey
 * @constructor
 */
declare function PublicKey(data: string, extra: {
    network: Network | string;
    compressed?: boolean | undefined;
}): PublicKey;
declare class PublicKey {
    /**
     * Instantiate a PublicKey from a {@link PrivateKey}, {@link Point}, `string`, or `Buffer`.
     *
     * There are two internal properties, `network` and `compressed`, that deal with importing
     * a PublicKey from a PrivateKey in WIF format. More details described on {@link PrivateKey}
     *
     * @example
     * ```javascript
     * // instantiate from a private key
     * var key = PublicKey(privateKey, true);
     *
     * // export to as a DER hex encoded string
     * var exported = key.toString();
     *
     * // import the public key
     * var imported = PublicKey.fromString(exported);
     * ```
     *
     * @param {string} data - The encoded data in various formats
     * @param {Object} extra - additional options
     * @param {Network|string} extra.network - Which network should the address for this public key be for
     * @param {boolean=} extra.compressed - If the public key is compressed
     * @returns {PublicKey} A new valid instance of an PublicKey
     * @constructor
     */
    constructor(data: string, extra: {
        network: Network | string;
        compressed?: boolean | undefined;
    });
    /**
     * @type {Point} - the {@link Point} instance that this PublicKey represents
     */
    point: Point;
    /**
     * @type {Network|string} - which network this key is on (only useful for addresses)
     */
    network: Network | string;
    /**
     * @type {boolean} - if the public key is compressed
     */
    compressed: boolean;
    private _classifyArgs;
    /**
     * Converts the PublicKey instance to a plain object or JSON representation.
     * The object includes the x and y coordinates of the point in hexadecimal format,
     * along with the compression flag.
     *
     * @returns {{x: string, y: string, compressed: boolean}} An object with properties:
     *   - x: The x-coordinate of the point as a hex string.
     *   - y: The y-coordinate of the point as a hex string.
     *   - compressed: A boolean indicating if the key is compressed.
     */
    toObject: () => {
        x: string;
        y: string;
        compressed: boolean;
    };
    toJSON(): {
        x: string;
        y: string;
        compressed: boolean;
    };
    /**
     * Will output the PublicKey to a DER Buffer
     *
     * @returns {Buffer} A DER hex encoded buffer
     */
    toBuffer: () => Buffer;
    toDER(): Buffer;
    /**
     * Will return a sha256 + ripemd160 hash of the serialized public key
     * @see https://github.com/bitcoin/bitcoin/blob/master/src/pubkey.h#L141
     * @returns {Buffer}
     */
    _getID(): Buffer;
    /**
     * Will return an address for the public key
     *
     * @param {string|Network} [network] - Which network should the address be for
     * @returns {Address} An address generated from the public key
     */
    toAddress(network?: string | Network): Address;
    /**
     * Will output the PublicKey to a DER encoded hex string
     *
     * @returns {string} A DER hex encoded string
     */
    toString: () => string;
    toHex(): string;
    /**
     * Will return a string formatted for the console
     *
     * @returns {string} Public key
     */
    inspect(): string;
}
declare namespace PublicKey {
    /**
     * Internal function to detect if an object is a {@link PrivateKey}
     *
     * @param {*} param - object to test
     * @returns {boolean}
     * @private
     */
    function _isPrivateKey(param: any): boolean;
    /**
     * Internal function to detect if an object is a Buffer
     *
     * @param {*} param - object to test
     * @returns {boolean}
     * @private
     */
    function _isBuffer(param: any): boolean;
    /**
     * Internal function to transform a private key into a public key point
     *
     * @param {PrivateKey} privkey - An instance of PrivateKey
     * @returns {{point: Point, compressed?: boolean, network?: string|Network}} An object with keys: point and compressed
     * @private
     */
    function _transformPrivateKey(privkey: PrivateKey): {
        point: Point;
        compressed?: boolean;
        network?: string | Network;
    };
    /**
     * Internal function to transform DER into a public key point
     *
     * @param {Buffer} buf - An DER buffer
     * @param {boolean=} strict - if set to false, will loosen some conditions
     * @returns {{point: Point, compressed?: boolean, network?: string|Network}} An object with keys: point and compressed
     *
     * @private
     */
    function _transformDER(buf: Buffer, strict?: boolean): {
        point: Point;
        compressed?: boolean;
        network?: string | Network;
    };
    /**
     * Internal function to transform X into a public key point
     *
     * @param {Boolean} odd - If the point is above or below the x axis
     * @param {Point} x - The x point
     * @returns {{point: Point, compressed?: boolean, network?: string|Network}} An object with keys: point and compressed
     * @private
     */
    function _transformX(odd: boolean, x: Point): {
        point: Point;
        compressed?: boolean;
        network?: string | Network;
    };
    /**
     * Internal function to transform a JSON into a public key point
     *
     * @param {Object} json - a JSON string or plain object
     * @param {string} json.x - The x coordinate of the public key
     * @param {string} json.y - The y coordinate of the public key
     * @param {boolean} json.compressed - Whether the public key is compressed
     * @returns {{point: Point, compressed?: boolean, network?: string|Network}} A publicKey with keys: point and compressed
     * @private
     */
    function _transformObject(json: {
        x: string;
        y: string;
        compressed: boolean;
    }): {
        point: Point;
        compressed?: boolean;
        network?: string | Network;
    };
    /**
     * Instantiate a PublicKey from a PrivateKey
     *
     * @param {PrivateKey} privkey - An instance of PrivateKey
     * @returns {{point: Point, compressed?: boolean, network?: string|Network}} A new valid instance of PublicKey
     */
    function fromPrivateKey(privkey: PrivateKey): {
        point: Point;
        compressed?: boolean;
        network?: string | Network;
    };
    function fromDER(buf: Buffer, strict?: boolean): {
        point: Point;
        compressed?: boolean;
        network?: string | Network;
    };
    function fromBuffer(buf: Buffer, strict?: boolean): {
        point: Point;
        compressed?: boolean;
        network?: string | Network;
    };
    /**
     * Instantiate a PublicKey from a Point
     *
     * @param {Point} point - A Point instance
     * @param {boolean=} compressed - whether to store this public key as compressed format
     * @returns {PublicKey} A new valid instance of PublicKey
     */
    function fromPoint(point: Point, compressed?: boolean): PublicKey;
    function fromHex(str: string, encoding?: string): PublicKey;
    function fromString(str: string, encoding?: string): PublicKey;
    /**
     * Instantiate a PublicKey from an X Point
     *
     * @param {Boolean} odd - If the point is above or below the x axis
     * @param {Point} x - The x point
     * @returns {PublicKey} A new valid instance of PublicKey
     */
    function fromX(odd: boolean, x: Point): PublicKey;
    /**
     * Check if there would be any errors when initializing a PublicKey
     *
     * @param {string} data - The encoded data in various formats
     * @returns {null|Error} An error if exists
     */
    function getValidationError(data: string): Error;
    /**
     * Check if the parameters are valid
     *
     * @param {string} data - The encoded data in various formats
     * @returns {Boolean} If the public key would be valid
     */
    function isValid(data: string): boolean;
}
import Network = require("./network.cjs");
import Point = require("./crypto/point.cjs");
import Address = require("./address.cjs");
