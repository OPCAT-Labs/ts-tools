export = Varint;
/**
 * Creates a Varint instance from various input types.
 * @constructor
 * @param {Buffer|number|BN|{buf: Buffer}} buf - Input can be a Buffer, number, BN instance, or object with buffer properties.
 * @returns {Varint} New Varint instance when called without `new`.
 */
declare function Varint(buf: Buffer | number | BN | {
    buf: Buffer;
}): Varint;
declare class Varint {
    /**
     * Creates a Varint instance from various input types.
     * @constructor
     * @param {Buffer|number|BN|{buf: Buffer}} buf - Input can be a Buffer, number, BN instance, or object with buffer properties.
     * @returns {Varint} New Varint instance when called without `new`.
     */
    constructor(buf: Buffer | number | BN | {
        buf: Buffer;
    });
    buf: Buffer;
    /**
     * Sets the buffer for the Varint instance.
     * @param {Object} obj - The object containing the buffer to set.
     * @param {Buffer} [obj.buf] - The buffer to assign. If not provided, keeps the current buffer.
     * @returns {Varint} The Varint instance for chaining.
     */
    set(obj: {
        buf?: Buffer;
    }): Varint;
    /**
     * Converts a hex string to a Varint buffer and updates the instance.
     * @param {string} str - Hex string to convert.
     * @returns {Varint} The updated Varint instance.
     */
    fromString(str: string): Varint;
    /**
     * Converts the Varint buffer to a hexadecimal string representation.
     * @returns {string} Hexadecimal string of the buffer.
     */
    toString(): string;
    /**
     * Sets the internal buffer to the provided buffer and returns the instance.
     * @param {Buffer} buf - The buffer to set as the internal buffer.
     * @returns {Varint} The instance for chaining.
     */
    fromBuffer(buf: Buffer): Varint;
    /**
     * Reads a varint from a buffer reader and stores it in the instance.
     * @param {BufferReader} br - The buffer reader instance to read from.
     * @returns {Varint} The current Varint instance for chaining.
     */
    fromBufferReader(br: BufferReader): Varint;
    /**
     * Converts a BigNumber (BN) to a varint and stores it in the buffer.
     * @param {BN} bn - The BigNumber to convert to varint format.
     * @returns {Varint} Returns the Varint instance for chaining.
     */
    fromBN(bn: BN): Varint;
    /**
     * Converts a number to a varint and stores it in the buffer.
     * @param {number} num - The number to convert to varint format.
     * @returns {Varint} Returns the instance for chaining.
     */
    fromNumber(num: number): Varint;
    /**
     * Returns the internal buffer of the Varint instance.
     * @returns {Buffer} The internal buffer.
     */
    toBuffer(): Buffer;
    /**
     * Converts the Varint buffer to a BigNumber (BN) instance.
     * @returns {BN} The BigNumber representation of the Varint buffer.
     */
    toBN(): BN;
    /**
     * Converts the Varint buffer to a number.
     * @returns {number} The numeric representation of the Varint buffer.
     */
    toNumber(): number;
}
import BN = require("../bn.cjs");
import BufferReader = require("./bufferreader.cjs");
