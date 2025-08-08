export = PublicKeyHashInput;
/**
 * Represents a special kind of input of PayToPublicKeyHash kind.
 * @constructor
 * @param {Object} params - Input parameters object
 * @param {string|Buffer} params.prevTxId - Previous transaction ID (hex string or Buffer)
 * @param {number} params.outputIndex - Output index in previous transaction
 * @param {Output} [params.output] - Output instance or output parameters
 * @param {number} [params.sequenceNumber] - Sequence number (defaults to DEFAULT_SEQNUMBER)
 * @param {Script|Buffer|string} [params.script] - Script instance, buffer or hex string
 */
declare function PublicKeyHashInput(params: {
    prevTxId: string | Buffer;
    outputIndex: number;
    output?: Output;
    sequenceNumber?: number;
    script?: Script | Buffer | string;
}, ...args: any[]): void;
declare class PublicKeyHashInput {
    /**
     * Represents a special kind of input of PayToPublicKeyHash kind.
     * @constructor
     * @param {Object} params - Input parameters object
     * @param {string|Buffer} params.prevTxId - Previous transaction ID (hex string or Buffer)
     * @param {number} params.outputIndex - Output index in previous transaction
     * @param {Output} [params.output] - Output instance or output parameters
     * @param {number} [params.sequenceNumber] - Sequence number (defaults to DEFAULT_SEQNUMBER)
     * @param {Script|Buffer|string} [params.script] - Script instance, buffer or hex string
     */
    constructor(params: {
        prevTxId: string | Buffer;
        outputIndex: number;
        output?: Output;
        sequenceNumber?: number;
        script?: Script | Buffer | string;
    }, ...args: any[]);
    /**
     * @param {Object} transaction - the transaction to be signed
     * @param {PrivateKey} privateKey - the private key with which to sign the transaction
     * @param {number} index - the index of the input in the transaction input vector
     * @param {number} [sigtype] - the type of signature, defaults to Signature.SIGHASH_ALL
     * @param {Buffer} [hashData] - the precalculated hash of the public key associated with the privateKey provided
     * @return {Array.<TransactionSignature>} the signatures of the public key hash input, if any
     */
    getSignatures(transaction: any, privateKey: PrivateKey, index: number, sigtype?: number, hashData?: Buffer): Array<TransactionSignature>;
    /**
     * Adds a signature to the input and updates the script.
     * @param {Object} transaction - The transaction to validate against.
     * @param {TransactionSignature} signature - The signature object containing publicKey, signature (DER format), and sigtype.
     * @returns {PublicKeyHashInput} Returns the instance for chaining.
     * @throws {Error} Throws if the signature is invalid.
     */
    addSignature(transaction: any, signature: TransactionSignature): PublicKeyHashInput;
    /**
     * Clear the input's signature
     * @return {PublicKeyHashInput} this, for chaining
     */
    clearSignatures(): PublicKeyHashInput;
    /**
     * Query whether the input is signed
     * @return {boolean}
     */
    isFullySigned(): boolean;
    private _estimateSize;
}
declare namespace PublicKeyHashInput {
    let SCRIPT_MAX_SIZE: number;
}
import Output = require("../output.cjs");
import Script = require("../../script/script.cjs");
import PrivateKey = require("../../privatekey.cjs");
import TransactionSignature = require("../signature.cjs");
