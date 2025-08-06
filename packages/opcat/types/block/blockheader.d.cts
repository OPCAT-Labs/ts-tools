export = BlockHeader;
/**
 * Instantiate a BlockHeader from a Buffer, JSON object, or Object with
 * the properties of the BlockHeader
 *
 * @param {Buffer|{prevHash: string|Buffer, merkleRoot: string|Buffer, hash: string, version: number, time: number, bits: number, nonce: number}} arg - A Buffer, JSON string, or Object
 * @returns {BlockHeader} - An instance of block header
 * @constructor
 */
declare function BlockHeader(arg: Buffer | {
    prevHash: string | Buffer;
    merkleRoot: string | Buffer;
    hash: string;
    version: number;
    time: number;
    bits: number;
    nonce: number;
}): BlockHeader;
declare class BlockHeader {
    /**
     * Instantiate a BlockHeader from a Buffer, JSON object, or Object with
     * the properties of the BlockHeader
     *
     * @param {Buffer|{prevHash: string|Buffer, merkleRoot: string|Buffer, hash: string, version: number, time: number, bits: number, nonce: number}} arg - A Buffer, JSON string, or Object
     * @returns {BlockHeader} - An instance of block header
     * @constructor
     */
    constructor(arg: Buffer | {
        prevHash: string | Buffer;
        merkleRoot: string | Buffer;
        hash: string;
        version: number;
        time: number;
        bits: number;
        nonce: number;
    });
    version: number;
    prevHash: Buffer;
    merkleRoot: Buffer;
    time: number;
    timestamp: number;
    bits: number;
    nonce: number;
    /**
     * Converts the BlockHeader instance into a plain JavaScript object or JSON representation.
     * This method is used for serialization and includes all relevant block header fields.
     *
     * @returns {{hash: string, version: number, prevHash: string, merkleRoot: string, time: number, bits: number, nonce: number}} An object containing the block header properties:
     *   - hash: The block hash.
     *   - version: The block version.
     *   - prevHash: The previous block hash, reversed and converted to hex.
     *   - merkleRoot: The merkle root of the block, reversed and converted to hex.
     *   - time: The block timestamp.
     *   - bits: The block difficulty bits.
     *   - nonce: The block nonce.
     */
    toObject: () => {
        hash: string;
        version: number;
        prevHash: string;
        merkleRoot: string;
        time: number;
        bits: number;
        nonce: number;
    };
    toJSON(): {
        hash: string;
        version: number;
        prevHash: string;
        merkleRoot: string;
        time: number;
        bits: number;
        nonce: number;
    };
    /**
     * @returns {Buffer} - A Buffer of the BlockHeader
     */
    toBuffer(): Buffer;
    /**
     * @returns {string} - A hex encoded string of the BlockHeader
     */
    toString(): string;
    /**
     * @param {BufferWriter} [bw] - An existing instance BufferWriter
     * @returns {BufferWriter} - An instance of BufferWriter representation of the BlockHeader
     */
    toBufferWriter(bw?: BufferWriter): BufferWriter;
    /**
     * Returns the target difficulty for this block
     * @param {Number} bits
     * @returns {BN} An instance of BN with the decoded difficulty bits
     */
    getTargetDifficulty(bits: number): BN;
    /**
     * @link https://en.bitcoin.it/wiki/Difficulty
     * @return {Number}
     */
    getDifficulty(): number;
    private _getHash;
    id: any;
    hash: any;
    /**
     * @returns {Boolean} - If timestamp is not too far in the future
     */
    validTimestamp(): boolean;
    /**
     * @returns {Boolean} - If the proof-of-work hash satisfies the target difficulty
     */
    validProofOfWork(): boolean;
    /**
     * @returns {string} - A string formatted for the console
     */
    inspect(): string;
}
declare namespace BlockHeader {
    /**
     * @param {Buffer|{prevHash: string|Buffer, merkleRoot: string|Buffer, hash: string, version: number, time: number, bits: number, nonce: number}} arg - A Buffer, JSON string or Object
     * @returns {{version: number, prevHash: Buffer, merkleRoot: Buffer, time: number, bits: number, nonce: number}} - An object representing block header data
     * @throws {TypeError} - If the argument was not recognized
     * @private
     */
    function _from(arg: Buffer | {
        prevHash: string | Buffer;
        merkleRoot: string | Buffer;
        hash: string;
        version: number;
        time: number;
        bits: number;
        nonce: number;
    }): {
        version: number;
        prevHash: Buffer;
        merkleRoot: Buffer;
        time: number;
        bits: number;
        nonce: number;
    };
    /**
     * @param {{prevHash: string|Buffer, merkleRoot: string|Buffer, hash: string, version: number, time: number, bits: number, nonce: number}} data - A JSON string
     * @returns {{prevHash: Buffer, merkleRoot: Buffer, hash: string, version: number, time: number, bits: number, nonce: number}} - An object representing block header data
     * @private
     */
    function _fromObject(data: {
        prevHash: string | Buffer;
        merkleRoot: string | Buffer;
        hash: string;
        version: number;
        time: number;
        bits: number;
        nonce: number;
    }): {
        prevHash: Buffer;
        merkleRoot: Buffer;
        hash: string;
        version: number;
        time: number;
        bits: number;
        nonce: number;
    };
    /**
     * @param {{prevHash: string|Buffer, merkleRoot: string|Buffer, hash: string, version: number, time: number, bits: number, nonce: number}} obj - A plain JavaScript object
     * @returns {BlockHeader} - An instance of block header
     */
    function fromObject(obj: {
        prevHash: string | Buffer;
        merkleRoot: string | Buffer;
        hash: string;
        version: number;
        time: number;
        bits: number;
        nonce: number;
    }): BlockHeader;
    /**
     * @param {Buffer|string} data - Raw block binary data or buffer
     * @returns {BlockHeader} - An instance of block header
     */
    function fromRawBlock(data: string | Buffer): BlockHeader;
    /**
     * @param {Buffer} buf - A buffer of the block header
     * @returns {BlockHeader} - An instance of block header
     */
    function fromBuffer(buf: Buffer): BlockHeader;
    /**
     * @param {string} str - A hex encoded buffer of the block header
     * @returns {BlockHeader} - An instance of block header
     */
    function fromString(str: string): BlockHeader;
    /**
     * @param {BufferReader} br - A BufferReader of the block header
     * @returns {{version: number, prevHash: Buffer, merkleRoot: Buffer, time: number, bits: number, nonce: number}} - An object representing block header data
     * @private
     */
    function _fromBufferReader(br: BufferReader): {
        version: number;
        prevHash: Buffer;
        merkleRoot: Buffer;
        time: number;
        bits: number;
        nonce: number;
    };
    /**
     * @param {BufferReader} br - A BufferReader of the block header
     * @returns {BlockHeader} - An instance of block header
     */
    function fromBufferReader(br: BufferReader): BlockHeader;
    namespace Constants {
        let START_OF_HEADER: number;
        let MAX_TIME_OFFSET: number;
        let LARGEST_HASH: BN;
    }
}
import BufferWriter = require("../encoding/bufferwriter.cjs");
import BN = require("../bn.cjs");
import BufferReader = require("../encoding/bufferreader.cjs");
