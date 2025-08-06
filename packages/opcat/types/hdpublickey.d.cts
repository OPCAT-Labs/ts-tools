export = HDPublicKey;
/**
 * The representation of an hierarchically derived public key.
 *
 * See https://github.com/bitcoin/bips/blob/master/bip-0032.mediawiki
 *
 * @constructor
 * @param {{ network: Network, depth: number, fingerPrint: number, parentFingerPrint: number, childIndex: number, chainCode: string, publicKey: string, checksum: number, xpubkey: string }|string|Buffer} arg
 */
declare function HDPublicKey(arg: {
    network: Network;
    depth: number;
    fingerPrint: number;
    parentFingerPrint: number;
    childIndex: number;
    chainCode: string;
    publicKey: string;
    checksum: number;
    xpubkey: string;
} | string | Buffer): HDPublicKey;
declare class HDPublicKey {
    /**
     * The representation of an hierarchically derived public key.
     *
     * See https://github.com/bitcoin/bips/blob/master/bip-0032.mediawiki
     *
     * @constructor
     * @param {{ network: Network, depth: number, fingerPrint: number, parentFingerPrint: number, childIndex: number, chainCode: string, publicKey: string, checksum: number, xpubkey: string }|string|Buffer} arg
     */
    constructor(arg: {
        network: Network;
        depth: number;
        fingerPrint: number;
        parentFingerPrint: number;
        childIndex: number;
        chainCode: string;
        publicKey: string;
        checksum: number;
        xpubkey: string;
    } | string | Buffer);
    /**
     * WARNING: This method will not be officially supported until v1.0.0.
     *
     *
     * Get a derivated child based on a string or number.
     *
     * If the first argument is a string, it's parsed as the full path of
     * derivation. Valid values for this argument include "m" (which returns the
     * same public key), "m/0/1/40/2/1000".
     *
     * Note that hardened keys can't be derived from a public extended key.
     *
     * If the first argument is a number, the child with that index will be
     * derived. See the example usage for clarification.
     *
     * @example
     * ```javascript
     * var parent = new HDPublicKey('xpub...');
     * var child_0_1_2 = parent.deriveChild(0).deriveChild(1).deriveChild(2);
     * var copy_of_child_0_1_2 = parent.deriveChild("m/0/1/2");
     * assert(child_0_1_2.xprivkey === copy_of_child_0_1_2);
     * ```
     *
     * @param {string|number} arg - The index or path to derive
     * @param {boolean} [hardened=false] - Whether to use hardened derivation
     * @returns {HDPublicKey} The derived child public key
     */
    deriveChild(arg: string | number, hardened?: boolean): HDPublicKey;
    private _deriveWithNumber;
    private _deriveFromString;
    private _buildFromObject;
    private _buildFromSerialized;
    private _buildFromBuffers;
    /**
     * Returns the base58 checked representation of the public key
     * @return {string} a string starting with "xpub..." in livenet
     */
    toString(): string;
    /**
     * Returns the console representation of this extended public key.
     * @return string
     */
    inspect(): string;
    /**
     * Converts the HDPublicKey instance into a plain object representation.
     * This method is also aliased as `toJSON` for JSON serialization compatibility.
     *
     * @returns {{ network: Network, depth: number, fingerPrint: number, parentFingerPrint: number, childIndex: number, chainCode: string, publicKey: string, checksum: number, xpubkey: string }} An object containing the HDPublicKey properties:
     *   - network: The network name derived from the version buffer.
     *   - depth: The depth of the key in the hierarchy.
     *   - fingerPrint: The fingerprint of the key.
     *   - parentFingerPrint: The fingerprint of the parent key.
     *   - childIndex: The index of the child key.
     *   - chainCode: The chain code as a hexadecimal string.
     *   - publicKey: The public key as a string.
     *   - checksum: The checksum of the key.
     *   - xpubkey: The extended public key string.
     */
    toObject: () => {
        network: Network;
        depth: number;
        fingerPrint: number;
        parentFingerPrint: number;
        childIndex: number;
        chainCode: string;
        publicKey: string;
        checksum: number;
        xpubkey: string;
    };
    toJSON(): {
        network: Network;
        depth: number;
        fingerPrint: number;
        parentFingerPrint: number;
        childIndex: number;
        chainCode: string;
        publicKey: string;
        checksum: number;
        xpubkey: string;
    };
    /**
     * Return a buffer representation of the xpubkey
     *
     * @return {Buffer}
     */
    toBuffer(): Buffer;
    /**
     * Return a hex string representation of the xpubkey
     *
     * @return {Buffer}
     */
    toHex(): Buffer;
}
declare namespace HDPublicKey {
    /**
     * Checks if a given argument is a valid HD public key derivation path.
     * @param {string|number} arg - The path to validate (either as string like "m/0/1" or as a single index number).
     * @returns {boolean} True if the path is valid, false otherwise.
     * @description Validates both string paths (e.g., "m/0/1") and individual derivation indexes.
     * String paths must contain valid indexes separated by '/', and each index must be a non-negative number less than HDPublicKey.Hardened.
     */
    function isValidPath(arg: string | number): boolean;
    /**
     * Verifies that a given serialized public key in base58 with checksum format
     * is valid.
     *
     * @param {string|Buffer} data - the serialized public key
     * @param {string|Network} [network]  - optional, if present, checks that the
     *     network provided matches the network serialized.
     * @return {boolean}
     */
    function isValidSerialized(data: string | Buffer, network?: string | Network): boolean;
    /**
     * Checks what's the error that causes the validation of a serialized public key
     * in base58 with checksum to fail.
     *
     * @param {string|Buffer} data - the serialized public key
     * @param {string|Network} [network] - optional, if present, checks that the
     *     network provided matches the network serialized.
     * @return {Error|null}
     */
    function getSerializedError(data: string | Buffer, network?: string | Network): Error;
    /**
     * Validates if the provided data matches the expected network version.
     * @param {Buffer} data - The data containing the version to validate.
     * @param {string|Network} networkArg - The network or network identifier to validate against.
     * @returns {Error|null} Returns an error if validation fails, otherwise null.
     * @private
     */
    function _validateNetwork(data: Buffer, networkArg: string | Network): Error;
    /**
     * Validates buffer arguments for HDPublicKey.
     * @private
     * @param {Object} arg - The argument object containing buffer fields to validate
     * @param {Buffer} arg.version - Version buffer (must be HDPublicKey.VersionSize bytes)
     * @param {Buffer} arg.depth - Depth buffer (must be HDPublicKey.DepthSize bytes)
     * @param {Buffer} arg.parentFingerPrint - Parent fingerprint buffer (must be HDPublicKey.ParentFingerPrintSize bytes)
     * @param {Buffer} arg.childIndex - Child index buffer (must be HDPublicKey.ChildIndexSize bytes)
     * @param {Buffer} arg.chainCode - Chain code buffer (must be HDPublicKey.ChainCodeSize bytes)
     * @param {Buffer} arg.publicKey - Public key buffer (must be HDPublicKey.PublicKeySize bytes)
     * @param {Buffer} [arg.checksum] - Optional checksum buffer (must be HDPublicKey.CheckSumSize bytes if provided)
     * @throws {Error} If any buffer is invalid or has incorrect size
     */
    function _validateBufferArguments(arg: {
        version: Buffer;
        depth: Buffer;
        parentFingerPrint: Buffer;
        childIndex: Buffer;
        chainCode: Buffer;
        publicKey: Buffer;
        checksum?: Buffer;
    }): void;
    /**
     * Creates an HDPublicKey instance from a string representation.
     * @param {string} arg - The string to convert to an HDPublicKey.
     * @returns {HDPublicKey} A new HDPublicKey instance.
     * @throws {Error} Throws if the input is not a valid string.
     */
    function fromString(arg: string): HDPublicKey;
    /**
     * Creates an HDPublicKey instance from an object.
     * @param {{ network: Network, depth: number, fingerPrint: number, parentFingerPrint: number, childIndex: number, chainCode: string, publicKey: string, checksum: number, xpubkey: string }} arg - The object containing public key data
     * @returns {HDPublicKey} A new HDPublicKey instance
     * @throws {Error} Will throw if no valid object argument is provided
     */
    function fromObject(arg: {
        network: Network;
        depth: number;
        fingerPrint: number;
        parentFingerPrint: number;
        childIndex: number;
        chainCode: string;
        publicKey: string;
        checksum: number;
        xpubkey: string;
    }): HDPublicKey;
    /**
     * Create a HDPublicKey from a buffer argument
     *
     * @param {Buffer} arg
     * @return {HDPublicKey}
     */
    function fromBuffer(arg: Buffer): HDPublicKey;
    /**
     * Create a HDPublicKey from a hex string argument
     *
     * @param {string} hex - The hex representation of an xpubkey
     * @return {HDPublicKey}
     */
    function fromHex(hex: string): HDPublicKey;
    let Hardened: number;
    let RootElementAlias: string[];
    let VersionSize: number;
    let DepthSize: number;
    let ParentFingerPrintSize: number;
    let ChildIndexSize: number;
    let ChainCodeSize: number;
    let PublicKeySize: number;
    let CheckSumSize: number;
    let DataSize: number;
    let SerializedByteSize: number;
    let VersionStart: number;
    let VersionEnd: number;
    let DepthStart: number;
    let DepthEnd: number;
    let ParentFingerPrintStart: number;
    let ParentFingerPrintEnd: number;
    let ChildIndexStart: number;
    let ChildIndexEnd: number;
    let ChainCodeStart: number;
    let ChainCodeEnd: number;
    let PublicKeyStart: number;
    let PublicKeyEnd: number;
    let ChecksumStart: number;
    let ChecksumEnd: number;
}
import Network = require("./network.cjs");
