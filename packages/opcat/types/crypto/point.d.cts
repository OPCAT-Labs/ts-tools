export = Point;
/**
 * Instantiate a valid secp256k1 Point from the X and Y coordinates. This class
 * is just an extension of the secp256k1 code from the library "elliptic" by
 * Fedor Indutny. It includes a few extra features that are useful in Bitcoin.
 *
 * @param {BN|String} x - The X coordinate
 * @param {BN|String} y - The Y coordinate
 * @param {boolean} [isRed] - Whether the Y coordinate is red or not
 * @link https://github.com/indutny/elliptic
 * @augments elliptic.curve.point
 * @throws {Error} A validation error if exists
 * @returns {Point} An instance of Point
 * @constructor
 */
declare function Point(x: BN | string, y: BN | string, isRed?: boolean): Point;
declare class Point {
    /**
     * Instantiate a valid secp256k1 Point from the X and Y coordinates. This class
     * is just an extension of the secp256k1 code from the library "elliptic" by
     * Fedor Indutny. It includes a few extra features that are useful in Bitcoin.
     *
     * @param {BN|String} x - The X coordinate
     * @param {BN|String} y - The Y coordinate
     * @param {boolean} [isRed] - Whether the Y coordinate is red or not
     * @link https://github.com/indutny/elliptic
     * @augments elliptic.curve.point
     * @throws {Error} A validation error if exists
     * @returns {Point} An instance of Point
     * @constructor
     */
    constructor(x: BN | string, y: BN | string, isRed?: boolean);
    /** @private */
    private _getX;
    /**
     * Will return the X coordinate of the Point.
     *
     * @returns {BN} A BN instance of the X coordinate
     */
    getX(): BN;
    /** @private */
    private _getY;
    /**
     * Will return the Y coordinate of the Point.
     *
     * @returns {BN} A BN instance of the Y coordinate
     */
    getY(): BN;
    /**
     * Will determine if the point is valid.
     *
     * @link https://www.iacr.org/archive/pkc2003/25670211/25670211.pdf
     * @throws {Error} A validation error if exists
     * @returns {Point} An instance of the same Point
     */
    validate(): Point;
    /**
     * Convert point to a compressed buffer.
     *
     * @returns {Buffer} A compressed point.
     */
    toBuffer(): Buffer;
    /**
     * Convert point to a compressed hex string.
     *
     * @returns {string} A compressed point as a hex string.
     */
    toHex(): string;
}
declare namespace Point {
    /**
     *
     * Instantiate a valid secp256k1 Point from only the X coordinate. This is
     * useful to rederive a full point from the compressed form of a point.
     *
     * @param {boolean} odd - If the Y coordinate is odd
     * @param {BN|String} x - The X coordinate
     * @throws {Error} A validation error if exists
     * @returns {Point} An instance of Point
     * @static
     */
    function fromX(odd: boolean, x: string | BN): Point;
    /**
     *
     * Will return a secp256k1 ECDSA base point.
     *
     * @link https://en.bitcoin.it/wiki/Secp256k1
     * @returns {Point} An instance of the base point.
     * @static
     */
    function getG(): Point;
    /**
     *
     * Will return the max of range of valid private keys as governed by the
     * secp256k1 ECDSA standard.
     *
     * @link https://en.bitcoin.it/wiki/Private_key#Range_of_valid_ECDSA_private_keys
     * @returns {BN} A BN instance of the number of points on the curve
     * @static
     */
    function getN(): BN;
    /**
     * A "compressed" format point is the X part of the (X, Y) point plus an extra
     * bit (which takes an entire byte) to indicate whether the Y value is odd or
     * not. Storing points this way takes a bit less space, but requires a bit more
     * computation to rederive the full point.
     *
     * @param {Point} point An instance of Point.
     * @returns {Buffer} A compressed point in the form of a buffer.
     * @static
     */
    function pointToCompressed(point: Point): Buffer;
    /**
     * Converts a compressed buffer into a point.
     *
     * @param {Buffer} buf A compressed point.
     * @returns {Point} A Point.
     * @static
     */
    function pointFromCompressed(buf: Buffer): Point;
    /**
     * Converts a compressed buffer into a point.
     *
     * @param {Buffer} buf A compressed point.
     * @returns {Point} A Point.
     * @static
     */
    function fromBuffer(buf: Buffer): Point;
    /**
     * Converts a compressed buffer into a point.
     *
     * @param {Buffer} hex A compressed point as a hex string.
     * @returns {Point} A Point.
     * @static
     */
    function fromHex(hex: Buffer): Point;
}
import BN = require("../bn.cjs");
