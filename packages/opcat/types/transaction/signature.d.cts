export = TransactionSignature;
/**
 * @desc
 * Wrapper around Signature with fields related to signing a transaction specifically
 *
 * @param {{publicKey: string, prevTxId: string, outputIndex: number, inputIndex: number, signature: string, sigtype: number}|TransactionSignature} arg
 * @constructor
 */
declare function TransactionSignature(arg: {
    publicKey: string;
    prevTxId: string;
    outputIndex: number;
    inputIndex: number;
    signature: string;
    sigtype: number;
} | TransactionSignature): TransactionSignature;
declare class TransactionSignature {
    /**
     * @desc
     * Wrapper around Signature with fields related to signing a transaction specifically
     *
     * @param {{publicKey: string, prevTxId: string, outputIndex: number, inputIndex: number, signature: string, sigtype: number}|TransactionSignature} arg
     * @constructor
     */
    constructor(arg: {
        publicKey: string;
        prevTxId: string;
        outputIndex: number;
        inputIndex: number;
        signature: string;
        sigtype: number;
    } | TransactionSignature);
    private _fromObject;
    publicKey: PublicKey;
    prevTxId: Buffer;
    outputIndex: number;
    inputIndex: number;
    signature: Signature;
    sigtype: number;
    private _checkObjectArgs;
    /**
     * Serializes a transaction to a plain JS object
     * @return {{publicKey: string, prevTxId: string, outputIndex: number, inputIndex: number, signature: string, sigtype: number}}
     */
    toObject: () => {
        publicKey: string;
        prevTxId: string;
        outputIndex: number;
        inputIndex: number;
        signature: string;
        sigtype: number;
    };
    toJSON(): {
        publicKey: string;
        prevTxId: string;
        outputIndex: number;
        inputIndex: number;
        signature: string;
        sigtype: number;
    };
}
declare namespace TransactionSignature {
    /**
     * Builds a TransactionSignature from an object
     * @param {{publicKey: string, prevTxId: string, outputIndex: number, inputIndex: number, signature: string, sigtype: number}} object
     * @return {TransactionSignature}
     */
    function fromObject(object: {
        publicKey: string;
        prevTxId: string;
        outputIndex: number;
        inputIndex: number;
        signature: string;
        sigtype: number;
    }): TransactionSignature;
}
import PublicKey = require("../publickey.cjs");
import Signature = require("../crypto/signature.cjs");
