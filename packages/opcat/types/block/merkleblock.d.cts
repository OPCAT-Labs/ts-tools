export = MerkleBlock;
/**
 * Instantiate a MerkleBlock from a Buffer, JSON object, or Object with
 * the properties of the Block
 *
 * @param {Buffer|String|{header:{prevHash: string|Buffer, merkleRoot: string|Buffer, hash: string, version: number, time: number, bits: number, nonce: number}, numTransactions: number, hashes: [string|Buffer], flags: [number]}} arg - A buffer, JSON string, or ObjectBuffer, JSON string, or Object representing a MerkleBlock
 * @returns {MerkleBlock}
 * @constructor
 */
declare function MerkleBlock(arg: Buffer | string | {
    header: {
        prevHash: string | Buffer;
        merkleRoot: string | Buffer;
        hash: string;
        version: number;
        time: number;
        bits: number;
        nonce: number;
    };
    numTransactions: number;
    hashes: [string | Buffer];
    flags: [number];
}): MerkleBlock;
declare class MerkleBlock {
    /**
     * Instantiate a MerkleBlock from a Buffer, JSON object, or Object with
     * the properties of the Block
     *
     * @param {Buffer|String|{header:{prevHash: string|Buffer, merkleRoot: string|Buffer, hash: string, version: number, time: number, bits: number, nonce: number}, numTransactions: number, hashes: [string|Buffer], flags: [number]}} arg - A buffer, JSON string, or ObjectBuffer, JSON string, or Object representing a MerkleBlock
     * @returns {MerkleBlock}
     * @constructor
     */
    constructor(arg: Buffer | string | {
        header: {
            prevHash: string | Buffer;
            merkleRoot: string | Buffer;
            hash: string;
            version: number;
            time: number;
            bits: number;
            nonce: number;
        };
        numTransactions: number;
        hashes: [string | Buffer];
        flags: [number];
    });
    /** @type BlockHeader */
    header: BlockHeader;
    /** @type number */
    numTransactions: number;
    /** @type string[] */
    hashes: string[];
    /** @type number */
    flags: number;
    _flagBitsUsed: number;
    _hashesUsed: number;
    /**
     * @returns {Buffer} - A buffer of the block
     */
    toBuffer(): Buffer;
    /**
     * @param {BufferWriter} [bw] - An existing instance of BufferWriter
     * @returns {BufferWriter} - An instance of BufferWriter representation of the MerkleBlock
     */
    toBufferWriter(bw?: BufferWriter): BufferWriter;
    /**
     * @returns {{header: {hash: string, version: number, prevHash: string, merkleRoot: string, time: number, bits: number, nonce: number}, numTransactions: number, hashes: string[], flags: number[]}} - A plain object with the MerkleBlock properties
     */
    toObject: () => {
        header: {
            hash: string;
            version: number;
            prevHash: string;
            merkleRoot: string;
            time: number;
            bits: number;
            nonce: number;
        };
        numTransactions: number;
        hashes: string[];
        flags: number[];
    };
    toJSON(): {
        header: {
            hash: string;
            version: number;
            prevHash: string;
            merkleRoot: string;
            time: number;
            bits: number;
            nonce: number;
        };
        numTransactions: number;
        hashes: string[];
        flags: number[];
    };
    /**
     * Verify that the MerkleBlock is valid
     * @returns {Boolean} - True/False whether this MerkleBlock is Valid
     */
    validMerkleTree(): boolean;
    /**
     * Return a list of all the txs hash that match the filter
     * @returns {Array.<string>} - txs hash that match the filter
     */
    filteredTxsHash(): Array<string>;
    private _traverseMerkleTree;
    private _calcTreeWidth;
    private _calcTreeHeight;
    /**
     * @param {Transaction|String} tx - Transaction or Transaction ID Hash
     * @returns {Boolean} - return true/false if this MerkleBlock has the TX or not
     */
    hasTransaction(tx: Transaction | string): boolean;
}
declare namespace MerkleBlock {
    /**
     * @param {Buffer} buf - MerkleBlock data in a Buffer object
     * @returns {MerkleBlock} - A MerkleBlock object
     */
    function fromBuffer(buf: Buffer): MerkleBlock;
    /**
     * @param {BufferReader} br - MerkleBlock data in a BufferReader object
     * @returns {MerkleBlock} - A MerkleBlock object
     */
    function fromBufferReader(br: BufferReader): MerkleBlock;
    /**
     * Parses a MerkleBlock from a buffer reader.
     * @private
     * @param {BufferReader} br - The buffer reader containing the MerkleBlock data
     * @returns {{header: BlockHeader, numTransactions: number, hashes: string[], flags: number[]}} - The parsed MerkleBlock.An object containing:
     *   - header {BlockHeader} - The block header
     *   - numTransactions {number} - Number of transactions in the block
     *   - hashes {string[]} - Array of transaction hashes as hex strings
     *   - flags {number[]} - Array of flag bytes
     * @throws {Error} If no merkleblock data is received
     */
    function _fromBufferReader(br: BufferReader): {
        header: BlockHeader;
        numTransactions: number;
        hashes: string[];
        flags: number[];
    };
    /**
     * Creates a MerkleBlock instance from a plain object.
     * @param {{header:{prevHash: string|Buffer, merkleRoot: string|Buffer, hash: string, version: number, time: number, bits: number, nonce: number}, numTransactions: number, hashes: [string|Buffer], flags: [number]}} obj - The plain object containing MerkleBlock data.
     * @returns {MerkleBlock} A new MerkleBlock instance.
     */
    function fromObject(obj: {
        header: {
            prevHash: string | Buffer;
            merkleRoot: string | Buffer;
            hash: string;
            version: number;
            time: number;
            bits: number;
            nonce: number;
        };
        numTransactions: number;
        hashes: [string | Buffer];
        flags: [number];
    }): MerkleBlock;
}
import BlockHeader = require("./blockheader.cjs");
import BufferWriter = require("../encoding/bufferwriter.cjs");
import Transaction = require("../transaction/transaction.cjs");
import BufferReader = require("../encoding/bufferreader.cjs");
