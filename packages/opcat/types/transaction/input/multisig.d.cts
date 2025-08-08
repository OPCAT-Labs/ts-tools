export = MultiSigInput;
/**
 * Represents a MultiSigInput for a transaction.
 * @constructor
 * @param {{prevTxId: string|Buffer, outputIndex: number, output?: Output, sequenceNumber?: number, script?: Script|Buffer|string, publicKeys?: Array.<Buffer>, threshold?: number, signatures?: Array.<TransactionSignature>}} input - The input object containing publicKeys, threshold, and signatures.
 * @param {Array.<Buffer>} [pubkeys] - Array of public keys (optional, defaults to input.publicKeys).
 * @param {number} [threshold] - Required number of signatures (optional, defaults to input.threshold).
 * @param {Array.<TransactionSignature>} [signatures] - Array of signatures (optional, defaults to input.signatures).
 * @description Validates that provided public keys match the output script and initializes signatures.
 */
declare function MultiSigInput(input: {
    prevTxId: string | Buffer;
    outputIndex: number;
    output?: Output;
    sequenceNumber?: number;
    script?: Script | Buffer | string;
    publicKeys?: Array<Buffer>;
    threshold?: number;
    signatures?: Array<TransactionSignature>;
}, pubkeys?: Array<Buffer>, threshold?: number, signatures?: Array<TransactionSignature>, ...args: any[]): void;
declare class MultiSigInput {
    /**
     * Represents a MultiSigInput for a transaction.
     * @constructor
     * @param {{prevTxId: string|Buffer, outputIndex: number, output?: Output, sequenceNumber?: number, script?: Script|Buffer|string, publicKeys?: Array.<Buffer>, threshold?: number, signatures?: Array.<TransactionSignature>}} input - The input object containing publicKeys, threshold, and signatures.
     * @param {Array.<Buffer>} [pubkeys] - Array of public keys (optional, defaults to input.publicKeys).
     * @param {number} [threshold] - Required number of signatures (optional, defaults to input.threshold).
     * @param {Array.<TransactionSignature>} [signatures] - Array of signatures (optional, defaults to input.signatures).
     * @description Validates that provided public keys match the output script and initializes signatures.
     */
    constructor(input: {
        prevTxId: string | Buffer;
        outputIndex: number;
        output?: Output;
        sequenceNumber?: number;
        script?: Script | Buffer | string;
        publicKeys?: Array<Buffer>;
        threshold?: number;
        signatures?: Array<TransactionSignature>;
    }, pubkeys?: Array<Buffer>, threshold?: number, signatures?: Array<TransactionSignature>, ...args: any[]);
    publicKeys: PublicKey[];
    publicKeyIndex: {};
    threshold: number;
    signatures: any[];
    /**
     * Converts the MultiSigInput instance to a plain object representation.
     * Includes threshold, publicKeys (converted to strings), and serialized signatures.
     * @returns {{threshold: number, publicKeys: Array.<string>, signatures: any, prevTxId: string, outputIndex: number, sequenceNumber: number, script: string, scriptString?: string, output?: {satoshis: number, script: string, data: string}}} The plain object representation of the MultiSigInput.
     */
    toObject(): {
        threshold: number;
        publicKeys: Array<string>;
        signatures: any;
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
    };
    private _deserializeSignatures;
    private _serializeSignatures;
    /**
     * Gets signatures for a MultiSigInput by signing the transaction with the provided private key.
     * Only signs for public keys that match the private key's public key.
     *
     * @param {Object} transaction - The transaction to sign
     * @param {PrivateKey} privateKey - The private key used for signing
     * @param {number} index - The input index
     * @param {number} [sigtype=Signature.SIGHASH_ALL] - The signature type
     * @returns {TransactionSignature[]} Array of transaction signatures
     */
    getSignatures(transaction: any, privateKey: PrivateKey, index: number, sigtype?: number): TransactionSignature[];
    /**
     * Adds a signature to the MultiSigInput if valid and not already fully signed.
     * @param {Object} transaction - The transaction to validate the signature against.
     * @param {TransactionSignature} signature - The signature object containing publicKey and signature data.
     * @throws {Error} If already fully signed, no matching public key, or invalid signature.
     * @returns {MultiSigInput} Returns the instance for chaining.
     */
    addSignature(transaction: any, signature: TransactionSignature): MultiSigInput;
    /**
     * Updates the multisig input script by rebuilding it with current public keys, threshold, and signatures.
     * @returns {MultiSigInput} Returns the instance for chaining.
     */
    _updateScript(): MultiSigInput;
    /**
     * Creates DER-encoded signatures from the input's signature data.
     * Filters out undefined signatures and converts each valid signature to a Buffer
     * containing the DER-encoded signature followed by its sigtype byte.
     * @returns {Buffer[]} Array of signature Buffers
     */
    _createSignatures(): Buffer[];
    /**
     * Clears all signatures from the MultiSigInput by resetting the signatures array
     * and updating the script. The signatures array length matches the publicKeys array.
     */
    clearSignatures(): void;
    /**
     * Checks if the MultiSigInput is fully signed by comparing the number of signatures
     * with the required threshold.
     * @returns {boolean} True if the input has enough signatures, false otherwise.
     */
    isFullySigned(): boolean;
    /**
     * Returns the number of missing signatures required to meet the threshold.
     * @returns {number} The count of missing signatures.
     */
    countMissingSignatures(): number;
    /**
     * Counts the number of valid signatures in the MultiSigInput.
     * @returns {number} The count of non-null/undefined signatures.
     */
    countSignatures(): number;
    /**
     * Returns an array of public keys that haven't been signed yet in this MultiSigInput.
     * @returns {Array.<PublicKey>} Array of unsigned public keys
     */
    publicKeysWithoutSignature(): Array<PublicKey>;
    /**
     * Verifies a signature for a MultiSigInput transaction.
     *
     * @param {Object} transaction - The transaction to verify.
     * @param {TransactionSignature} signature - The signature to verify.bject containing signature data.
     * @returns {boolean} True if the signature is valid, false otherwise.
     */
    isValidSignature(transaction: any, signature: TransactionSignature): boolean;
    private _estimateSize;
}
declare namespace MultiSigInput {
    /**
     * Normalizes signatures for a MultiSigInput by matching each public key with its corresponding signature.
     * Filters and validates signatures against the provided public keys and transaction.
     *
     * @param {Object} transaction - The transaction to verify against.
     * @param {Input} input - The input containing prevTxId and outputIndex.
     * @param {number} inputIndex - The index of the input in the transaction.
     * @param {Array.<Buffer>} signatures - Array of signature buffers to normalize.
     * @param {Array.<PublicKey>} publicKeys - Array of public keys to match signatures against.
     * @returns {Array.<TransactionSignature|null>} Array of matched signatures or null for unmatched keys.
     */
    function normalizeSignatures(transaction: any, input: Input, inputIndex: number, signatures: Buffer[], publicKeys: PublicKey[]): TransactionSignature[];
    let SIGNATURE_SIZE: number;
}
import Output = require("../output.cjs");
import Script = require("../../script/script.cjs");
import TransactionSignature = require("../signature.cjs");
import PublicKey = require("../../publickey.cjs");
import PrivateKey = require("../../privatekey.cjs");
import Input = require("./input.cjs");
