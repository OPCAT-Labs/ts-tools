export = Block;
/**
 * Instantiate a Block from a Buffer, JSON object, or Object with
 * the properties of the Block
 *
 * @param {Buffer|{transactions: Array.<{outputs: Array.<{satoshis: number, script: string, data?: string}>, inputs: Array.<{prevTxId: string, outputIndex: number, sequenceNumber: number, script: string}>, hash: string, version: number, nLockTime: number}>, header: {prevHash: string|Buffer, merkleRoot: string|Buffer, hash: string, version: number, time: number, bits: number, nonce: number}}} arg - A Buffer, JSON string, or Object
 * @returns {Block}
 * @constructor
 */
declare function Block(arg: Buffer | {
    transactions: Array<{
        outputs: Array<{
            satoshis: number;
            script: string;
            data?: string;
        }>;
        inputs: Array<{
            prevTxId: string;
            outputIndex: number;
            sequenceNumber: number;
            script: string;
        }>;
        hash: string;
        version: number;
        nLockTime: number;
    }>;
    header: {
        prevHash: string | Buffer;
        merkleRoot: string | Buffer;
        hash: string;
        version: number;
        time: number;
        bits: number;
        nonce: number;
    };
}): Block;
declare class Block {
    /**
     * Instantiate a Block from a Buffer, JSON object, or Object with
     * the properties of the Block
     *
     * @param {Buffer|{transactions: Array.<{outputs: Array.<{satoshis: number, script: string, data?: string}>, inputs: Array.<{prevTxId: string, outputIndex: number, sequenceNumber: number, script: string}>, hash: string, version: number, nLockTime: number}>, header: {prevHash: string|Buffer, merkleRoot: string|Buffer, hash: string, version: number, time: number, bits: number, nonce: number}}} arg - A Buffer, JSON string, or Object
     * @returns {Block}
     * @constructor
     */
    constructor(arg: Buffer | {
        transactions: Array<{
            outputs: Array<{
                satoshis: number;
                script: string;
                data?: string;
            }>;
            inputs: Array<{
                prevTxId: string;
                outputIndex: number;
                sequenceNumber: number;
                script: string;
            }>;
            hash: string;
            version: number;
            nLockTime: number;
        }>;
        header: {
            prevHash: string | Buffer;
            merkleRoot: string | Buffer;
            hash: string;
            version: number;
            time: number;
            bits: number;
            nonce: number;
        };
    });
    /** @type {Array.<Transaction>} - The block transactions */
    transactions: Array<Transaction>;
    /** @type {BlockHeader} - The block header */
    header: BlockHeader;
    /**
     * Converts the Block instance to a plain object (also aliased as toJSON).
     * @returns {{transactions: Array.<{outputs: Array.<{satoshis: number, script: string, data: string}>, inputs: Array.<{prevTxId: string, outputIndex: number, sequenceNumber: number, script: string, scriptString?: string, output?: {satoshis: number, script: string, data: string}}>, hash: string, version: number, nLockTime: number, changeScript?: string, changeAddress?: string, changeIndex?: number, fee?: number}>, header: {version: number, prevHash: string, merkleRoot: string, hash: string, nTime: number, bits: number, nonce: number, time: number}}} The plain object representation of the Block.
     */
    toObject: () => {
        transactions: Array<{
            outputs: Array<{
                satoshis: number;
                script: string;
                data: string;
            }>;
            inputs: Array<{
                prevTxId: string;
                outputIndex: number;
                sequenceNumber: number;
                script: string;
                scriptString?: string;
                output?: {
                    satoshis: number;
                    script: string;
                    data: string;
                };
            }>;
            hash: string;
            version: number;
            nLockTime: number;
            changeScript?: string;
            changeAddress?: string;
            changeIndex?: number;
            fee?: number;
        }>;
        header: {
            version: number;
            prevHash: string;
            merkleRoot: string;
            hash: string;
            nTime: number;
            bits: number;
            nonce: number;
            time: number;
        };
    };
    toJSON(): {
        transactions: Array<{
            outputs: Array<{
                satoshis: number;
                script: string;
                data: string;
            }>;
            inputs: Array<{
                prevTxId: string;
                outputIndex: number;
                sequenceNumber: number;
                script: string;
                scriptString?: string;
                output?: {
                    satoshis: number;
                    script: string;
                    data: string;
                };
            }>;
            hash: string;
            version: number;
            nLockTime: number;
            changeScript?: string;
            changeAddress?: string;
            changeIndex?: number;
            fee?: number;
        }>;
        header: {
            version: number;
            prevHash: string;
            merkleRoot: string;
            hash: string;
            nTime: number;
            bits: number;
            nonce: number;
            time: number;
        };
    };
    /**
     * Converts the block to a buffer representation.
     * @returns {Buffer} The buffer containing the block data.
     */
    toBuffer(): Buffer;
    /**
     * Returns the string representation of the Block instance.
     * @returns {string} - A hex encoded string of the block
     */
    toString(): string;
    /**
     * @param {BufferWriter} [bw] - An existing instance of BufferWriter
     * @returns {BufferWriter} - An instance of BufferWriter representation of the Block
     */
    toBufferWriter(bw?: BufferWriter): BufferWriter;
    /**
     * Will iterate through each transaction and return an array of hashes
     * @returns {Array.<Buffer>} - An array with transaction hashes
     */
    getTransactionHashes(): Array<Buffer>;
    /**
     * Will build a merkle tree of all the transactions, ultimately arriving at
     * a single point, the merkle root.
     * @link https://en.bitcoin.it/wiki/Protocol_specification#Merkle_Trees
     * @returns {Array.<Buffer>} - An array with each level of the tree after the other.
     */
    getMerkleTree(): Array<Buffer>;
    /**
     * Calculates the merkleRoot from the transactions.
     * @returns {Buffer} - A buffer of the merkle root hash
     */
    getMerkleRoot(): Buffer;
    /**
     * Verifies that the transactions in the block match the header merkle root
     * @returns {Boolean} - If the merkle roots match
     */
    validMerkleRoot(): boolean;
    /**
     * @returns {Buffer} - The little endian hash buffer of the header
     */
    _getHash(): Buffer;
    id: any;
    hash: any;
    /**
     * @returns {string} - A string formatted for the console
     */
    inspect(): string;
}
declare namespace Block {
    export let MAX_BLOCK_SIZE: number;
    /**
     * Creates a Block instance from the given argument.
     * @param {Buffer|{transactions: Array.<Transaction|{outputs: Array.<{satoshis: number, script: string, data: string}>, inputs: Array.<{prevTxId: string, outputIndex: number, sequenceNumber: number, script: string, scriptString?: string, output?: {satoshis: number, script: string, data: string}}>, hash: string, version: number, nLockTime: number, changeScript?: string, changeAddress?: string, changeIndex?: number, fee?: number}>, header: {prevHash: string|Buffer, merkleRoot: string|Buffer, hash: string, version: number, time: number, bits: number, nonce: number}}} arg - The input to convert into a Block.
     * @returns {Block} A new Block instance.
     * @throws {TypeError} - If the argument was not recognized
     * @private
     */
    export function _from(arg: Buffer | {
        transactions: (Transaction | {
            outputs: {
                satoshis: number;
                script: string;
                data: string;
            }[];
            inputs: {
                prevTxId: string;
                outputIndex: number;
                sequenceNumber: number;
                script: string;
                scriptString?: string;
                output?: {
                    satoshis: number;
                    script: string;
                    data: string;
                };
            }[];
            hash: string;
            version: number;
            nLockTime: number;
            changeScript?: string;
            changeAddress?: string;
            changeIndex?: number;
            fee?: number;
        })[];
        header: {
            prevHash: string | Buffer;
            merkleRoot: string | Buffer;
            hash: string;
            version: number;
            time: number;
            bits: number;
            nonce: number;
        };
    }): Block;
    /**
     * Creates a Block instance from a plain object.
     * @param {{transactions: Array.<{outputs: Array.<{satoshis: number, script: string, data?: string}>, inputs: Array.<{prevTxId: string, outputIndex: number, sequenceNumber: number, script: string}>, hash: string, version: number, nLockTime: number}>, header: {prevHash: string|Buffer, merkleRoot: string|Buffer, hash: string, version: number, time: number, bits: number, nonce: number}}} data - The plain object containing block data.
     * @returns {Block} The created Block instance.
     * @private
     */
    export function _fromObject(data: {
        transactions: {
            outputs: {
                satoshis: number;
                script: string;
                data?: string;
            }[];
            inputs: {
                prevTxId: string;
                outputIndex: number;
                sequenceNumber: number;
                script: string;
            }[];
            hash: string;
            version: number;
            nLockTime: number;
        }[];
        header: {
            prevHash: string | Buffer;
            merkleRoot: string | Buffer;
            hash: string;
            version: number;
            time: number;
            bits: number;
            nonce: number;
        };
    }): Block;
    /**
     * Creates a Block instance from a plain JavaScript object.
     * @param {{transactions: Array.<{outputs: Array.<{satoshis: number, script: string, data?: string}>, inputs: Array.<{prevTxId: string, outputIndex: number, sequenceNumber: number, script: string}>, hash: string, version: number, nLockTime: number}>, header: {prevHash: string|Buffer, merkleRoot: string|Buffer, hash: string, version: number, time: number, bits: number, nonce: number}}} obj - The source object to convert to a Block.
     * @returns {Block} A new Block instance.
     */
    export function fromObject(obj: {
        transactions: {
            outputs: {
                satoshis: number;
                script: string;
                data?: string;
            }[];
            inputs: {
                prevTxId: string;
                outputIndex: number;
                sequenceNumber: number;
                script: string;
            }[];
            hash: string;
            version: number;
            nLockTime: number;
        }[];
        header: {
            prevHash: string | Buffer;
            merkleRoot: string | Buffer;
            hash: string;
            version: number;
            time: number;
            bits: number;
            nonce: number;
        };
    }): Block;
    /**
     * Creates a Block instance from a BufferReader.
     * @private
     * @param {BufferReader} br - The buffer reader containing block data
     * @returns {Block} The parsed Block instance
     */
    export function _fromBufferReader(br: BufferReader): Block;
    /**
     * Creates a Block instance from a BufferReader.
     * @param {BufferReader} br - The buffer reader containing block data.
     * @returns {Block} The parsed Block instance.
     */
    export function fromBufferReader(br: BufferReader): Block;
    /**
     * Creates a Block instance from a buffer.
     * @param {Buffer} buf - The input buffer to create the block from.
     * @returns {Block} The created Block instance.
     */
    export function fromBuffer(buf: Buffer): Block;
    /**
     * Creates a Block instance from a string representation.
     * @param {string} str - The string to parse into a Block.
     * @returns {Block} The parsed Block instance.
     */
    export function fromString(str: string): Block;
    /**
     * Creates a Block instance from raw block data.
     * @param {Buffer|string} data - The raw block data to convert.
     * @returns {Block} A new Block instance.
     */
    export function fromRawBlock(data: string | Buffer): Block;
    export namespace Values {
        let START_OF_BLOCK: number;
        let NULL_HASH: Buffer;
    }
    export { BlockHeader };
    export { MerkleBlock };
}
import Transaction = require("../transaction/transaction.cjs");
import BlockHeader = require("./blockheader.cjs");
import BufferWriter = require("../encoding/bufferwriter.cjs");
import BufferReader = require("../encoding/bufferreader.cjs");
import MerkleBlock = require("./merkleblock.cjs");
