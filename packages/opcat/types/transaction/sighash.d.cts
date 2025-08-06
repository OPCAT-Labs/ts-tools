export = Sighash;
/**
 * Represents a Sighash utility for cryptographic signature operations.
 * @constructor
 */
declare function Sighash(): void;
declare class Sighash {
}
declare namespace Sighash {
    /**
     * Returns a buffer with the which is hashed with sighash that needs to be signed
     * for OP_CHECKSIG.
     *
     * @name Signing.sighash
     * @param {Transaction} transaction the transaction to sign
     * @param {number} sighashType the type of the hash
     * @param {number} inputNumber the input index for the signature
     * @param {Script} subscript the script that will be signed
     * @param {satoshisBN} input's amount (for  ForkId signatures)
     * @returns {Buffer} the sighash preimage buffer
     *
     */
    function sighashPreimage(transaction: Transaction, sighashType: number, inputNumber: number): Buffer;
    /**
     * Generates a low-S sighash preimage for a transaction.
     * This function iteratively adjusts the transaction's lock time to ensure the sighash meets the low-S requirement.
     *
     * @param {Transaction} tx - The transaction object.
     * @param {number} sigtype - The signature type.
     * @param {number} inputIndex - The index of the input being signed.
     * @returns {Buffer} The preimage buffer that meets the low-S requirement.
     */
    function getLowSSighashPreimage(tx: Transaction, sigtype: number, inputIndex: number): Buffer;
    /**
     * Returns a buffer of length 32 bytes with the hash that needs to be signed
     * for OP_CHECKSIG.
     *
     * @name Signing.sighash
     * @param {Transaction} transaction the transaction to sign
     * @param {number} sighashType the type of the hash
     * @param {number} inputNumber the input index for the signature
     *
     */
    function sighash(transaction: Transaction, sighashType: number, inputNumber: number): Buffer;
    /**
     * Create a signature
     *
     * @name Signing.sign
     * @param {Transaction} transaction
     * @param {PrivateKey} privateKey
     * @param {number} sighashType
     * @param {number} inputIndex
     * @return {Signature}
     */
    function sign(transaction: Transaction, privateKey: PrivateKey, sighashType: number, inputIndex: number): Signature;
    /**
     * Verify a signature
     *
     * @name Signing.verify
     * @param {Transaction} transaction
     * @param {Signature} signature
     * @param {PublicKey} publicKey
     * @param {number} inputIndex
     * @param {Script} subscript
     * @param {satoshisBN} input's amount
     * @param {flags} verification flags
     * @return {boolean}
     */
    function verify(transaction: Transaction, signature: Signature, publicKey: PublicKey, inputIndex: number): boolean;
}
import Signature = require("../crypto/signature.cjs");
