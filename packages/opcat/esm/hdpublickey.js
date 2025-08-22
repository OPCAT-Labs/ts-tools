'use strict';

import _ from './util/_.js';
import $ from './util/preconditions.js';
import BN from './crypto/bn.js';
import Base58 from './encoding/base58.js';
import Base58Check from './encoding/base58check.js';
import Hash from './crypto/hash.js';
import Networks from './networks.js';
import Network from './network.js';
import Point from './crypto/point.js';
import PublicKey from './publickey.js';
import Derivation from './util/derivation.js';
import opcatErrors from './errors/index.js';
var errors = opcatErrors;
var hdErrors = opcatErrors.HDPublicKey;
import assert from 'assert';
import JSUtil from './util/js.js';


/**
 * The representation of an hierarchically derived public key.
 *
 * See https://github.com/bitcoin/bips/blob/master/bip-0032.mediawiki
 *
 * @constructor
 * @param {{ network: Network, depth: number, fingerPrint: number, parentFingerPrint: number, childIndex: number, chainCode: string, publicKey: string, checksum: number, xpubkey: string }|string|Buffer} arg
 */
function HDPublicKey(arg) {
  if (arg instanceof HDPublicKey) {
    return arg;
  }
  if (!(this instanceof HDPublicKey)) {
    return new HDPublicKey(arg);
  }
  if (arg) {
    if (_.isString(arg) || Buffer.isBuffer(arg)) {
      var error = HDPublicKey.getSerializedError(arg);
      if (!error) {
        return this._buildFromSerialized(arg);
      } else if (Buffer.isBuffer(arg) && !HDPublicKey.getSerializedError(arg.toString())) {
        return this._buildFromSerialized(arg.toString());
      } else {
        throw error;
      }
    } else {
      if (_.isObject(arg)) {
        return this._buildFromObject(arg);
      } else {
        throw new hdErrors.UnrecognizedArgument(arg);
      }
    }
  } else {
    throw new hdErrors.MustSupplyArgument();
  }
}



/**
 * Checks if a given argument is a valid HD public key derivation path.
 * @param {string|number} arg - The path to validate (either as string like "m/0/1" or as a single index number).
 * @returns {boolean} True if the path is valid, false otherwise.
 * @description Validates both string paths (e.g., "m/0/1") and individual derivation indexes.
 * String paths must contain valid indexes separated by '/', and each index must be a non-negative number less than HDPublicKey.Hardened.
 */
HDPublicKey.isValidPath = function (arg) {
  if (_.isString(arg)) {
    var indexes = Derivation.getDerivationIndexes(arg);
    return indexes !== null && _.every(indexes, HDPublicKey.isValidPath);
  }

  if (_.isNumber(arg)) {
    return arg >= 0 && arg < HDPublicKey.Hardened;
  }

  return false;
};


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
HDPublicKey.prototype.deriveChild = function (arg, hardened) {
  if (_.isNumber(arg)) {
    return this._deriveWithNumber(arg, hardened);
  } else if (_.isString(arg)) {
    return this._deriveFromString(arg);
  } else {
    throw new hdErrors.InvalidDerivationArgument(arg);
  }
};

/**
 * Derives a child public key from the current HD public key using the specified index.
 * @param {number} index - The child index to derive (must be less than HDPublicKey.Hardened)
 * @param {boolean} hardened - Whether to derive a hardened key (not supported for public keys)
 * @returns {HDPublicKey} The derived child public key
 * @throws {hdErrors.InvalidIndexCantDeriveHardened} If attempting to derive a hardened key
 * @throws {hdErrors.InvalidPath} If index is negative
 * @private
 */
HDPublicKey.prototype._deriveWithNumber = function (index, hardened) {
  if (index >= HDPublicKey.Hardened || hardened) {
    throw new hdErrors.InvalidIndexCantDeriveHardened();
  }
  if (index < 0) {
    throw new hdErrors.InvalidPath(index);
  }

  var indexBuffer = JSUtil.integerAsBuffer(index);
  var data = Buffer.concat([this.publicKey.toBuffer(), indexBuffer]);
  var hash = Hash.sha512hmac(data, this._buffers.chainCode);
  var leftPart = BN.fromBuffer(hash.slice(0, 32), { size: 32 });
  var chainCode = hash.slice(32, 64);

  var publicKey;
  try {
    publicKey = PublicKey.fromPoint(Point.getG().mul(leftPart).add(this.publicKey.point));
  } catch (e) {
    return this._deriveWithNumber(index + 1);
  }

  var derived = new HDPublicKey({
    network: this.network,
    depth: this.depth + 1,
    parentFingerPrint: this.fingerPrint,
    childIndex: index,
    chainCode: chainCode,
    publicKey: publicKey,
  });

  return derived;
};

/**
 * Derives a child public key from the current HD public key using the specified path.
 * @param {string} path - The derivation path (must not contain hardened derivation markers)
 * @returns {HDPublicKey} The derived public key
 * @throws {hdErrors.InvalidIndexCantDeriveHardened} If path contains hardened derivation markers
 * @throws {hdErrors.InvalidPath} If path is not a valid derivation path
 * @private
 */
HDPublicKey.prototype._deriveFromString = function (path) {
  if (_.includes(path, "'")) {
    throw new hdErrors.InvalidIndexCantDeriveHardened();
  } else if (!HDPublicKey.isValidPath(path)) {
    throw new hdErrors.InvalidPath(path);
  }

  var indexes = Derivation.getDerivationIndexes(path);
  var derived = indexes.reduce(function (prev, index) {
    return prev._deriveWithNumber(index);
  }, this);

  return derived;
};

/**
 * Verifies that a given serialized public key in base58 with checksum format
 * is valid.
 *
 * @param {string|Buffer} data - the serialized public key
 * @param {string|Network} [network]  - optional, if present, checks that the
 *     network provided matches the network serialized.
 * @return {boolean}
 */
HDPublicKey.isValidSerialized = function (data, network) {
  return _.isNull(HDPublicKey.getSerializedError(data, network));
};

/**
 * Checks what's the error that causes the validation of a serialized public key
 * in base58 with checksum to fail.
 *
 * @param {string|Buffer} data - the serialized public key
 * @param {string|Network} [network] - optional, if present, checks that the
 *     network provided matches the network serialized.
 * @return {Error|null}
 */
HDPublicKey.getSerializedError = function (data, network) {
  if (!(_.isString(data) || Buffer.isBuffer(data))) {
    return new hdErrors.UnrecognizedArgument('expected buffer or string');
  }
  if (!Base58.validCharacters(data)) {
    return new errors.InvalidB58Char('(unknown)', data);
  }
  try {
    data = Base58Check.decode(data);
  } catch (e) {
    return new errors.InvalidB58Checksum(data);
  }
  if (data.length !== HDPublicKey.DataSize) {
    return new hdErrors.InvalidLength(data);
  }
  if (!_.isUndefined(network)) {
    var error = HDPublicKey._validateNetwork(data, network);
    if (error) {
      return error;
    }
  }
  var version = data.readUInt32BE(0);
  if (version === Networks.livenet.xprivkey || version === Networks.testnet.xprivkey) {
    throw new hdErrors.ArgumentIsPrivateExtended();
  }
  return null;
};

/**
 * Validates if the provided data matches the expected network version.
 * @param {Buffer} data - The data containing the version to validate.
 * @param {string|Network} networkArg - The network or network identifier to validate against.
 * @returns {Error|null} Returns an error if validation fails, otherwise null.
 * @private
 */
HDPublicKey._validateNetwork = function (data, networkArg) {
  var network = Networks.get(networkArg);
  if (!network) {
    return new errors.InvalidNetworkArgument(networkArg);
  }
  var version = data.slice(HDPublicKey.VersionStart, HDPublicKey.VersionEnd);
  if (version.readUInt32BE(0) !== network.xpubkey) {
    return new errors.InvalidNetwork(version);
  }
  return null;
};

/**
 * Builds an HDPublicKey instance from an object containing key components.
 * Handles type conversion for various input formats (numbers, strings, buffers).
 * @param {Object} arg - Object containing key components (version, depth, parentFingerPrint, etc.)
 * @returns {HDPublicKey} The constructed public key instance
 * @private
 */
HDPublicKey.prototype._buildFromObject = function (arg) {
// TODO: Type validation
  var buffers = {
    version: arg.network ? JSUtil.integerAsBuffer(Networks.get(arg.network).xpubkey) : arg.version,
    depth: _.isNumber(arg.depth) ? Buffer.from([arg.depth & 0xff]) : arg.depth,
    parentFingerPrint: _.isNumber(arg.parentFingerPrint)
      ? JSUtil.integerAsBuffer(arg.parentFingerPrint)
      : arg.parentFingerPrint,
    childIndex: _.isNumber(arg.childIndex)
      ? JSUtil.integerAsBuffer(arg.childIndex)
      : arg.childIndex,
    chainCode: _.isString(arg.chainCode) ? Buffer.from(arg.chainCode, 'hex') : arg.chainCode,
    publicKey: _.isString(arg.publicKey)
      ? Buffer.from(arg.publicKey, 'hex')
      : Buffer.isBuffer(arg.publicKey)
      ? arg.publicKey
      : arg.publicKey.toBuffer(),
    checksum: _.isNumber(arg.checksum) ? JSUtil.integerAsBuffer(arg.checksum) : arg.checksum,
  };
  return this._buildFromBuffers(buffers);
};

/**
 * Builds an HDPublicKey instance from a serialized Base58Check encoded string.
 * @private
 * @param {string} arg - The Base58Check encoded extended public key (xpub)
 * @returns {HDPublicKey} The constructed HDPublicKey instance
 * @description
 * Decodes the input string into buffers for version, depth, parent fingerprint,
 * child index, chain code, public key, and checksum, then builds the key from buffers.
 */
HDPublicKey.prototype._buildFromSerialized = function (arg) {
  var decoded = Base58Check.decode(arg);
  var buffers = {
    version: decoded.slice(HDPublicKey.VersionStart, HDPublicKey.VersionEnd),
    depth: decoded.slice(HDPublicKey.DepthStart, HDPublicKey.DepthEnd),
    parentFingerPrint: decoded.slice(
      HDPublicKey.ParentFingerPrintStart,
      HDPublicKey.ParentFingerPrintEnd,
    ),
    childIndex: decoded.slice(HDPublicKey.ChildIndexStart, HDPublicKey.ChildIndexEnd),
    chainCode: decoded.slice(HDPublicKey.ChainCodeStart, HDPublicKey.ChainCodeEnd),
    publicKey: decoded.slice(HDPublicKey.PublicKeyStart, HDPublicKey.PublicKeyEnd),
    checksum: decoded.slice(HDPublicKey.ChecksumStart, HDPublicKey.ChecksumEnd),
    xpubkey: arg,
  };
  return this._buildFromBuffers(buffers);
};

/**
 * Receives a object with buffers in all the properties and populates the
 * internal structure
 *
 * @param {Object} arg
 * @param {buffer.Buffer} arg.version
 * @param {buffer.Buffer} arg.depth
 * @param {buffer.Buffer} arg.parentFingerPrint
 * @param {buffer.Buffer} arg.childIndex
 * @param {buffer.Buffer} arg.chainCode
 * @param {buffer.Buffer} arg.publicKey
 * @param {buffer.Buffer} arg.checksum
 * @param {string=} arg.xpubkey - if set, don't recalculate the base58
 *      representation
 * @return {HDPublicKey} this
 * @private
 */
HDPublicKey.prototype._buildFromBuffers = function (arg) {
  HDPublicKey._validateBufferArguments(arg);

  JSUtil.defineImmutable(this, {
    _buffers: arg,
  });

  var sequence = [
    arg.version,
    arg.depth,
    arg.parentFingerPrint,
    arg.childIndex,
    arg.chainCode,
    arg.publicKey,
  ];
  var concat = Buffer.concat(sequence);
  var checksum = Base58Check.checksum(concat);
  if (!arg.checksum || !arg.checksum.length) {
    arg.checksum = checksum;
  } else {
    if (arg.checksum.toString('hex') !== checksum.toString('hex')) {
      throw new errors.InvalidB58Checksum(concat, checksum);
    }
  }
  var network = Networks.get(arg.version.readUInt32BE(0));


  var xpubkey = Base58Check.encode(Buffer.concat(sequence));
  arg.xpubkey = Buffer.from(xpubkey);

  var publicKey = new PublicKey(arg.publicKey, { network: network });
  var size = HDPublicKey.ParentFingerPrintSize;
  var fingerPrint = Hash.sha256ripemd160(publicKey.toBuffer()).slice(0, size);
  /** @type {string} */
  this.xpubkey = xpubkey;
  /** @type {Network} */
  this.network = network;
  /** @type {number} */
  this.depth = arg.depth[0];
  /** @type {Buffer} */
  this.fingerPrint = fingerPrint;
  /** @type {PublicKey} */
  this.publicKey = publicKey;
  JSUtil.defineImmutable(this, {
    xpubkey: xpubkey,
    network: network,
    depth: arg.depth[0],
    publicKey: publicKey,
    fingerPrint: fingerPrint,
  });

  return this;
};

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
HDPublicKey._validateBufferArguments = function (arg) {
  var checkBuffer = function (name, size) {
    var buff = arg[name];
    assert(Buffer.isBuffer(buff), name + " argument is not a buffer, it's " + typeof buff);
    assert(
      buff.length === size,
      name + ' has not the expected size: found ' + buff.length + ', expected ' + size,
    );
  };
  checkBuffer('version', HDPublicKey.VersionSize);
  checkBuffer('depth', HDPublicKey.DepthSize);
  checkBuffer('parentFingerPrint', HDPublicKey.ParentFingerPrintSize);
  checkBuffer('childIndex', HDPublicKey.ChildIndexSize);
  checkBuffer('chainCode', HDPublicKey.ChainCodeSize);
  checkBuffer('publicKey', HDPublicKey.PublicKeySize);
  if (arg.checksum && arg.checksum.length) {
    checkBuffer('checksum', HDPublicKey.CheckSumSize);
  }
};

/**
 * Creates an HDPublicKey instance from a string representation.
 * @param {string} arg - The string to convert to an HDPublicKey.
 * @returns {HDPublicKey} A new HDPublicKey instance.
 * @throws {Error} Throws if the input is not a valid string.
 */
HDPublicKey.fromString = function (arg) {
  $.checkArgument(_.isString(arg), 'No valid string was provided');
  return new HDPublicKey(arg);
};

/**
 * Creates an HDPublicKey instance from an object.
 * @param {{ network: Network, depth: number, fingerPrint: number, parentFingerPrint: number, childIndex: number, chainCode: string, publicKey: string, checksum: number, xpubkey: string }} arg - The object containing public key data
 * @returns {HDPublicKey} A new HDPublicKey instance
 * @throws {Error} Will throw if no valid object argument is provided
 */
HDPublicKey.fromObject = function (arg) {
  $.checkArgument(_.isObject(arg), 'No valid argument was provided');
  return new HDPublicKey(arg);
};

/**
 * Returns the base58 checked representation of the public key
 * @return {string} a string starting with "xpub..." in livenet
 */
HDPublicKey.prototype.toString = function () {
  return this.xpubkey;
};

/**
 * Returns the console representation of this extended public key.
 * @return string
 */
HDPublicKey.prototype.inspect = function () {
  return '<HDPublicKey: ' + this.xpubkey + '>';
};

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
HDPublicKey.prototype.toObject = HDPublicKey.prototype.toJSON = function toObject() {
  return {
    network: Networks.get(this._buffers.version.readUInt32BE(0)).name,
    depth: this._buffers.depth[0],
    fingerPrint: this.fingerPrint.readUInt32BE(0),
    parentFingerPrint: this._buffers.parentFingerPrint.readUInt32BE(0),
    childIndex: this._buffers.childIndex.readUInt32BE(0),
    chainCode: this._buffers.chainCode.toString('hex'),
    publicKey: this.publicKey.toString(),
    checksum: this._buffers.checksum.readUInt32BE(0),
    xpubkey: this.xpubkey,
  };
};

/**
 * Create a HDPublicKey from a buffer argument
 *
 * @param {Buffer} arg
 * @return {HDPublicKey}
 */
HDPublicKey.fromBuffer = function (arg) {
  return new HDPublicKey(arg);
};

/**
 * Create a HDPublicKey from a hex string argument
 *
 * @param {string} hex - The hex representation of an xpubkey
 * @return {HDPublicKey}
 */
HDPublicKey.fromHex = function (hex) {
  return HDPublicKey.fromBuffer(Buffer.from(hex, 'hex'));
};

/**
 * Return a buffer representation of the xpubkey
 *
 * @return {Buffer}
 */
HDPublicKey.prototype.toBuffer = function () {
  return Buffer.from(this._buffers.xpubkey);
};

/**
 * Return a hex string representation of the xpubkey
 *
 * @return {Buffer}
 */
HDPublicKey.prototype.toHex = function () {
  return this.toBuffer().toString('hex');
};
/** @static @constant {number} */
HDPublicKey.Hardened = 0x80000000;
HDPublicKey.RootElementAlias = ['m', 'M'];

HDPublicKey.VersionSize = 4;
HDPublicKey.DepthSize = 1;
HDPublicKey.ParentFingerPrintSize = 4;
HDPublicKey.ChildIndexSize = 4;
HDPublicKey.ChainCodeSize = 32;
HDPublicKey.PublicKeySize = 33;
HDPublicKey.CheckSumSize = 4;

HDPublicKey.DataSize = 78;
HDPublicKey.SerializedByteSize = 82;

HDPublicKey.VersionStart = 0;
HDPublicKey.VersionEnd = 4;
HDPublicKey.DepthStart = 4;
HDPublicKey.DepthEnd = 5;
HDPublicKey.ParentFingerPrintStart = 5;
HDPublicKey.ParentFingerPrintEnd = 9;
HDPublicKey.ChildIndexStart = 9;
HDPublicKey.ChildIndexEnd = 13;
HDPublicKey.ChainCodeStart = 13;
HDPublicKey.ChainCodeEnd = 45;
HDPublicKey.PublicKeyStart = 45;
HDPublicKey.PublicKeyEnd = 78;
HDPublicKey.ChecksumStart = 78;
HDPublicKey.ChecksumEnd = 82;

assert(HDPublicKey.PublicKeyEnd === HDPublicKey.DataSize);
assert(HDPublicKey.ChecksumEnd === HDPublicKey.SerializedByteSize);

export default HDPublicKey;
