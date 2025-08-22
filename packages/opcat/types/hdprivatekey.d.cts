export = HDPrivateKey;
/**
 * Creates a new HDPrivateKey instance from various input formats.
 * More info on https://github.com/bitcoin/bips/blob/master/bip-0032.mediawiki
 * @constructor
 * @param {HDPrivateKey|string|Buffer|{network: string, depth: number, fingerPrint: number, parentFingerPrint: number, childIndex: number, chainCode: string, privateKey: string, checksum: number, xprivkey: string}} [arg] - Input can be:
 *   - Existing HDPrivateKey instance (returns same instance)
 *   - Network name (generates random key for that network)
 *   - Serialized string/Buffer (base58 encoded)
 *   - JSON string
 *   - Object with key properties
 * @throws {hdErrors.UnrecognizedArgument} If input format is not recognized
 * @throws {Error} If serialized input is invalid
 */
declare function HDPrivateKey(arg?: HDPrivateKey | string | Buffer | {
    network: string;
    depth: number;
    fingerPrint: number;
    parentFingerPrint: number;
    childIndex: number;
    chainCode: string;
    privateKey: string;
    checksum: number;
    xprivkey: string;
}): HDPrivateKey;
declare class HDPrivateKey {
    /**
     * Creates a new HDPrivateKey instance from various input formats.
     * More info on https://github.com/bitcoin/bips/blob/master/bip-0032.mediawiki
     * @constructor
     * @param {HDPrivateKey|string|Buffer|{network: string, depth: number, fingerPrint: number, parentFingerPrint: number, childIndex: number, chainCode: string, privateKey: string, checksum: number, xprivkey: string}} [arg] - Input can be:
     *   - Existing HDPrivateKey instance (returns same instance)
     *   - Network name (generates random key for that network)
     *   - Serialized string/Buffer (base58 encoded)
     *   - JSON string
     *   - Object with key properties
     * @throws {hdErrors.UnrecognizedArgument} If input format is not recognized
     * @throws {Error} If serialized input is invalid
     */
    constructor(arg?: HDPrivateKey | string | Buffer | {
        network: string;
        depth: number;
        fingerPrint: number;
        parentFingerPrint: number;
        childIndex: number;
        chainCode: string;
        privateKey: string;
        checksum: number;
        xprivkey: string;
    });
    get hdPublicKey(): HDPublicKey;
    get xpubkey(): string;
    /**
     * WARNING: This method will not be officially supported until v1.0.0.
     *
     *
     * Get a derived child based on a string or number.
     *
     * If the first argument is a string, it's parsed as the full path of
     * derivation. Valid values for this argument include "m" (which returns the
     * same private key), "m/0/1/40/2'/1000", where the ' quote means a hardened
     * derivation.
     *
     * If the first argument is a number, the child with that index will be
     * derived. If the second argument is truthy, the hardened version will be
     * derived. See the example usage for clarification.
     *
     * WARNING: The `nonCompliant` option should NOT be used, except for older implementation
     * that used a derivation strategy that used a non-zero padded private key.
     *
     * @example
     * ```javascript
     * var parent = new HDPrivateKey('xprv...');
     * var child_0_1_2h = parent.deriveChild(0).deriveChild(1).deriveChild(2, true);
     * var copy_of_child_0_1_2h = parent.deriveChild("m/0/1/2'");
     * assert(child_0_1_2h.xprivkey === copy_of_child_0_1_2h);
     * ```
     *
     * @param {string|number} arg
     * @param {boolean} [hardened]
     * @returns {HDPrivateKey} The derived child private key
     */
    deriveChild(arg: string | number, hardened?: boolean): HDPrivateKey;
    /**
     * WARNING: This method will not be officially supported until v1.0.0
     *
     *
     * WARNING: If this is a new implementation you should NOT use this method, you should be using
     * `derive` instead.
     *
     * This method is explicitly for use and compatibility with an implementation that
     * was not compliant with BIP32 regarding the derivation algorithm. The private key
     * must be 32 bytes hashing, and this implementation will use the non-zero padded
     * serialization of a private key, such that it's still possible to derive the privateKey
     * to recover those funds.
     *
     * @param {number|string} arg - Either a child index number or derivation path string
     * @param {boolean} [hardened] - Whether to create hardened derivation (only used with number arg)
     * @returns {HDPrivateKey} The derived child private key
     * @throws {hdErrors.InvalidDerivationArgument} If argument type is invalid
     */
    deriveNonCompliantChild(arg: number | string, hardened?: boolean): HDPrivateKey;
    private _deriveWithNumber;
    private _deriveFromString;
    private _buildFromJSON;
    private _buildFromObject;
    private _buildFromSerialized;
    private _generateRandomly;
    private _calcHDPublicKey;
    /**
     * Converts the HDPrivateKey instance to its corresponding HDPublicKey.
     * @returns {HDPublicKey} The derived HD public key.
     */
    toHDPublicKey(): HDPublicKey;
    /**
     * Returns the private key associated with this HD private key.
     * @returns {PrivateKey} The private key instance.
     */
    toPrivateKey(): PrivateKey;
    private _buildFromBuffers;
    /** @type {string} - The base58 encoding of the key*/
    xprivkey: string;
    /** @type {Network} - The network of the key*/
    network: Network;
    /** @type {number} - depth of the HD key in the hierarchy*/
    depth: number;
    /** @type {PrivateKey} */
    privateKey: PrivateKey;
    /** @type {PublicKey} */
    publicKey: PublicKey;
    /** @type {Buffer} */
    fingerPrint: Buffer;
    _hdPublicKey: HDPublicKey;
    /**
     * Returns the extended private key string representation of this HDPrivateKey.
     *  (a string starting with "xprv...")
     * @returns {string} The extended private key in base58 string format.
     */
    toString(): string;
    /**
     * Returns the console representation of this extended private key.
     * @return string
     */
    inspect(): string;
    /**
     * Converts the HDPrivateKey instance into a plain JavaScript object.
     * This method is also aliased as `toJSON` for JSON serialization compatibility.
     *
     * @returns {{network: string, depth: number, fingerPrint: number, parentFingerPrint: number, childIndex: number, chainCode: string, privateKey: string, checksum: number, xprivkey: string}} An object representing the HD private key with the following properties:
     *   - network: The network name associated with the key.
     *   - depth: The depth of the key in the hierarchy.
     *   - fingerPrint: The fingerprint of the key.
     *   - parentFingerPrint: The fingerprint of the parent key.
     *   - childIndex: The index of the child key.
     *   - chainCode: The chain code as a hexadecimal string.
     *   - privateKey: The private key as a hexadecimal string.
     *   - checksum: The checksum of the key.
     *   - xprivkey: The extended private key string.
     */
    toObject: () => {
        network: string;
        depth: number;
        fingerPrint: number;
        parentFingerPrint: number;
        childIndex: number;
        chainCode: string;
        privateKey: string;
        checksum: number;
        xprivkey: string;
    };
    toJSON(): {
        network: string;
        depth: number;
        fingerPrint: number;
        parentFingerPrint: number;
        childIndex: number;
        chainCode: string;
        privateKey: string;
        checksum: number;
        xprivkey: string;
    };
    /**
     * Returns a buffer representation of the HDPrivateKey
     *
     * @return {string}
     */
    toBuffer(): string;
    /**
     * Returns a hex string representation of the HDPrivateKey
     *
     * @return {string}
     */
    toHex(): string;
}
declare namespace HDPrivateKey {
    /**
     * Creates a new HDPrivateKey instance with random values.
     * @returns {HDPrivateKey} A new HDPrivateKey object with randomly generated properties.
     */
    function fromRandom(): HDPrivateKey;
    /**
     * Verifies that a given path is valid.
     *
     * @param {string|number} arg
     * @param {boolean} [hardened]
     * @return {boolean}
     */
    function isValidPath(arg: string | number, hardened?: boolean): boolean;
    /**
     * Verifies that a given serialized private key in base58 with checksum format
     * is valid.
     *
     * @param {string|Buffer} data - the serialized private key
     * @param {string|Network} [network] - optional, if present, checks that the
     *     network provided matches the network serialized.
     * @return {boolean}
     */
    function isValidSerialized(data: string | Buffer, network?: string | Network): boolean;
    /**
     * Checks what's the error that causes the validation of a serialized private key
     * in base58 with checksum to fail.
     *
     * @param {string|Buffer} data - the serialized private key
     * @param {string|Network} [network] - optional, if present, checks that the
     *     network provided matches the network serialized.
     * @return {Error|null} Returns the validation error, if any, otherwise null.
     */
    function getSerializedError(data: string | Buffer, network?: string | Network): Error;
    /**
     * Validates if the provided data matches the expected network's extended private key version.
     * @param {Buffer} data - The data buffer to validate (must include version bytes).
     * @param {string|Network} networkArg - Network identifier or Network object to validate against.
     * @returns {Error|null} Returns error if validation fails, otherwise null.
     * @private
     */
    function _validateNetwork(data: Buffer, networkArg: string | Network): Error;
    /**
     * Creates an HDPrivateKey instance from a string representation.
     * @param {string} arg - The string to convert to an HDPrivateKey
     * @returns {HDPrivateKey} A new HDPrivateKey instance
     * @throws {Error} If the input is not a valid string
     */
    function fromString(arg: string): HDPrivateKey;
    /**
     * Creates an HDPrivateKey instance from a plain object.
     * @param {Object} arg - The object containing HDPrivateKey properties.
     * @param {string} arg.network - Network used when the key was created.The object containing HDPrivateKey properties.
     * @param {number} arg.depth - The depth of the key in the hierarchy.
     * @param {number} arg.parentFingerPrint - The fingerprint of the parent key.
     * @param {number} arg.childIndex - The index of the key in the hierarchy.
     * @param {Buffer|string} arg.chainCode - The key's chainCode.
     * @param {Buffer|string} arg.privateKey - The private key.
     * @param {Buffer|string} [arg.checksum] - The checksum of the key.
     * @throws {Error} Throws if argument is not a valid object.
     * @returns {HDPrivateKey} A new HDPrivateKey instance.
     */
    function fromObject(arg: {
        network: string;
        depth: number;
        parentFingerPrint: number;
        childIndex: number;
        chainCode: string | Buffer;
        privateKey: string | Buffer;
        checksum?: string | Buffer;
    }): HDPrivateKey;
    /**
     * Generate a private key from a seed, as described in BIP32
     *
     * @param {string|Buffer} hexa - The entropy hex encoded or buffer of the seed.
     * @param {string} [network] - optional network name.
     * @return HDPrivateKey
     * @static
     */
    function fromSeed(hexa: string | Buffer, network?: string): HDPrivateKey;
    /**
     * Validates buffer arguments for HDPrivateKey.
     * Checks that each required buffer field exists and has the correct size.
     * @private
     * @param {Object} arg - Object containing buffer fields to validate
     * @param {Buffer} arg.version - Version buffer
     * @param {Buffer} arg.depth - Depth buffer
     * @param {Buffer} arg.parentFingerPrint - Parent fingerprint buffer
     * @param {Buffer} arg.childIndex - Child index buffer
     * @param {Buffer} arg.chainCode - Chain code buffer
     * @param {Buffer} arg.privateKey - Private key buffer
     * @param {Buffer} [arg.checksum] - Optional checksum buffer
     */
    function _validateBufferArguments(arg: {
        version: Buffer;
        depth: Buffer;
        parentFingerPrint: Buffer;
        childIndex: Buffer;
        chainCode: Buffer;
        privateKey: Buffer;
        checksum?: Buffer;
    }): void;
    /**
     * Build a HDPrivateKey from a buffer
     *
     * @param {Buffer} buf - Buffer for the xprivkey.
     * @return {HDPrivateKey} A new HDPrivateKey instance created from the buffer.
     * @throws {Error} If the buffer is not a valid serialized HDPrivateKey.
     */
    function fromBuffer(buf: Buffer): HDPrivateKey;
    /**
     * Build a HDPrivateKey from a hex string
     *
     * @param {string} hex
     * @return {HDPrivateKey}
     */
    function fromHex(hex: string): HDPrivateKey;
    let DefaultDepth: number;
    let DefaultFingerprint: number;
    let DefaultChildIndex: number;
    let Hardened: number;
    let MaxIndex: number;
    let RootElementAlias: string;
    let VersionSize: number;
    let DepthSize: number;
    let ParentFingerPrintSize: number;
    let ChildIndexSize: number;
    let ChainCodeSize: number;
    let PrivateKeySize: number;
    let CheckSumSize: number;
    let DataLength: number;
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
    let PrivateKeyStart: number;
    let PrivateKeyEnd: number;
    let ChecksumStart: number;
    let ChecksumEnd: number;
}
import HDPublicKey = require("./hdpublickey.cjs");
import PrivateKey = require("./privatekey.cjs");
import Network = require("./network.cjs");
import PublicKey = require("./publickey.cjs");
