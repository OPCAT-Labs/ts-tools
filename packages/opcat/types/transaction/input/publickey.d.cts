export = PublicKeyInput;
/**
 * Represents a special kind of input of PayToPublicKey kind.
 * @constructor
 * @param {Object} params - Input parameters object
 * @param {string|Buffer} params.prevTxId - Previous transaction ID (hex string or Buffer)
 * @param {number} params.outputIndex - Output index in previous transaction
 * @param {Output} [params.output] - Output instance or output parameters
 * @param {number} [params.sequenceNumber] - Sequence number (defaults to DEFAULT_SEQNUMBER)
 * @param {Script|Buffer|string} [params.script] - Script instance, buffer or hex string
 */
declare function PublicKeyInput(params: {
    prevTxId: string | Buffer;
    outputIndex: number;
    output?: Output;
    sequenceNumber?: number;
    script?: Script | Buffer | string;
}, ...args: any[]): void;
declare class PublicKeyInput {
    /**
     * Represents a special kind of input of PayToPublicKey kind.
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
     * @return {Array.<TransactionSignature>} the signatures of the public key input, if any
     */
    getSignatures(transaction: any, privateKey: PrivateKey, index: number, sigtype?: number): Array<TransactionSignature>;
    /**
     * Adds a signature to the public key input after validating it.
     * @param {Object} transaction - The transaction to validate against.
     * @param {TransactionSignature} signature - The signature object containing signature data and type.
     * @returns {PublicKeyInput} Returns the instance for chaining.
     * @throws {Error} Throws if the signature is invalid.
     */
    addSignature(transaction: any, signature: TransactionSignature): PublicKeyInput;
    /**
     * Clears all signatures from this input by setting an empty script.
     * @returns {PublicKeyInput} The instance for chaining.
     */
    clearSignatures(): PublicKeyInput;
    /**
     * Checks if the public key input is fully signed by verifying the script contains a public key.
     * @returns {boolean} True if the script contains a public key, false otherwise.
     */
    isFullySigned(): boolean;
    private _estimateSize;
}
declare namespace PublicKeyInput {
    let SCRIPT_MAX_SIZE: number;
}
import Output = require("../output.cjs");
import Script = require("../../script/script.cjs");
import PrivateKey = require("../../privatekey.cjs");
import TransactionSignature = require("../signature.cjs");
