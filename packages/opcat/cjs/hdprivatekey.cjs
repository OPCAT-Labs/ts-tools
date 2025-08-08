'use strict';

var assert = require('assert');
var _ = require('./util/_.cjs');
var $ = require('./util/preconditions.cjs');
var Derivation = require('./util/derivation.cjs');

var BN = require('./crypto/bn.cjs');
var Base58 = require('./encoding/base58.cjs');
var Base58Check = require('./encoding/base58check.cjs');
var Hash = require('./crypto/hash.cjs');
var Networks = require('./networks.cjs');
var Network = require('./network.cjs');
var Point = require('./crypto/point.cjs');
var PrivateKey = require('./privatekey.cjs');
var PublicKey = require('./publickey.cjs');
var Random = require('./crypto/random.cjs');
var HDPublicKey = require('./hdpublickey.cjs');
var JSUtil = require('./util/js.cjs');

var errors = require('./errors/index.cjs');

var hdErrors = errors.HDPrivateKey;

var MINIMUM_ENTROPY_BITS = 128;
var BITS_TO_BYTES = 1 / 8;
var MAXIMUM_ENTROPY_BITS = 512;

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
function HDPrivateKey(arg) {
  if (arg instanceof HDPrivateKey) {
    return arg;
  }
  if (!(this instanceof HDPrivateKey)) {
    return new HDPrivateKey(arg);
  }
  if (!arg) {
    return this._generateRandomly();
  }

  if (Networks.get(arg)) {
    return this._generateRandomly(arg);
  } else if (_.isString(arg) || Buffer.isBuffer(arg)) {
    if (HDPrivateKey.isValidSerialized(arg)) {
      this._buildFromSerialized(arg);
    } else if (JSUtil.isValidJSON(arg)) {
      this._buildFromJSON(arg);
    } else if (Buffer.isBuffer(arg) && HDPrivateKey.isValidSerialized(arg.toString())) {
      this._buildFromSerialized(arg.toString());
    } else {
      throw HDPrivateKey.getSerializedError(arg);
    }
  } else if (_.isObject(arg)) {
    this._buildFromObject(arg);
  } else {
    throw new hdErrors.UnrecognizedArgument(arg);
  }
}

/**
 * Gets the hdPublicKey of the HDPrivateKey.
 * @name HDPrivateKey.prototype.hdPublicKey
 * @type {HDPublicKey}
 * @memberof HDPrivateKey
 */
Object.defineProperty(HDPrivateKey.prototype, 'hdPublicKey', {
  configurable: false,
  enumerable: true,
  get: function () {
    return this._hdPublicKey;
  },
});

/**
 * Gets the xpubkey of the HDPrivateKey.
 * @name HDPrivateKey.prototype.xpubkey
 * @type {string}
 * @memberof HDPrivateKey
 */
Object.defineProperty(HDPrivateKey.prototype, 'xpubkey', {
  configurable: false,
  enumerable: true,
  get: function () {
    return this._hdPublicKey.xpubkey;
  },
});


/**
 * Creates a new HDPrivateKey instance with random values.
 * @returns {HDPrivateKey} A new HDPrivateKey object with randomly generated properties.
 */
HDPrivateKey.fromRandom = function () {
  return new HDPrivateKey();
};

/**
 * Verifies that a given path is valid.
 *
 * @param {string|number} arg
 * @param {boolean} [hardened]
 * @return {boolean}
 */
HDPrivateKey.isValidPath = function (arg, hardened) {
  if (_.isString(arg)) {
    var indexes = Derivation.getDerivationIndexes(arg);
    return indexes !== null && _.every(indexes, HDPrivateKey.isValidPath);
  }

  if (_.isNumber(arg)) {
    if (arg < HDPrivateKey.Hardened && hardened === true) {
      arg += HDPrivateKey.Hardened;
    }
    return arg >= 0 && arg < HDPrivateKey.MaxIndex;
  }

  return false;
};



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
HDPrivateKey.prototype.deriveChild = function (arg, hardened) {
  if (_.isNumber(arg)) {
    return this._deriveWithNumber(arg, hardened);
  } else if (_.isString(arg)) {
    return this._deriveFromString(arg);
  } else {
    throw new hdErrors.InvalidDerivationArgument(arg);
  }
};

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
HDPrivateKey.prototype.deriveNonCompliantChild = function (arg, hardened) {
  if (_.isNumber(arg)) {
    return this._deriveWithNumber(arg, hardened, true);
  } else if (_.isString(arg)) {
    return this._deriveFromString(arg, true);
  } else {
    throw new hdErrors.InvalidDerivationArgument(arg);
  }
};

/**
 * Derives a child HDPrivateKey from the current key using the specified index.
 * Handles both hardened and non-hardened derivation according to BIP32.
 * 
 * @param {number} index - The child index to derive
 * @param {boolean} [hardened] - Whether to use hardened derivation
 * @param {boolean} [nonCompliant=false] - If true, uses non-zero-padded private key serialization
 * @returns {HDPrivateKey} The derived child private key
 * @throws {hdErrors.InvalidPath} If the derivation path is invalid
 * @private
 */
HDPrivateKey.prototype._deriveWithNumber = function (index, hardened, nonCompliant) {
  if (!HDPrivateKey.isValidPath(index, hardened)) {
    throw new hdErrors.InvalidPath(index);
  }

  hardened = index >= HDPrivateKey.Hardened ? true : hardened;
  if (index < HDPrivateKey.Hardened && hardened === true) {
    index += HDPrivateKey.Hardened;
  }

  var indexBuffer = JSUtil.integerAsBuffer(index);
  var data;
  if (hardened && nonCompliant) {
    // The private key serialization in this case will not be exactly 32 bytes and can be
    // any value less, and the value is not zero-padded.
    var nonZeroPadded = this.privateKey.bn.toBuffer();
    data = Buffer.concat([Buffer.from([0]), nonZeroPadded, indexBuffer]);
  } else if (hardened) {
    // This will use a 32 byte zero padded serialization of the private key
    var privateKeyBuffer = this.privateKey.bn.toBuffer({ size: 32 });
    assert(
      privateKeyBuffer.length === 32,
      'length of private key buffer is expected to be 32 bytes',
    );
    data = Buffer.concat([Buffer.from([0]), privateKeyBuffer, indexBuffer]);
  } else {
    data = Buffer.concat([this.publicKey.toBuffer(), indexBuffer]);
  }
  var hash = Hash.sha512hmac(data, this._buffers.chainCode);
  var leftPart = BN.fromBuffer(hash.slice(0, 32), {
    size: 32,
  });
  var chainCode = hash.slice(32, 64);

  var privateKey = leftPart.add(this.privateKey.toBigNumber()).umod(Point.getN()).toBuffer({
    size: 32,
  });

  if (!PrivateKey.isValid(privateKey)) {
    // Index at this point is already hardened, we can pass null as the hardened arg
    return this._deriveWithNumber(index + 1, null, nonCompliant);
  }

  var derived = new HDPrivateKey({
    network: this.network,
    depth: this.depth + 1,
    parentFingerPrint: this.fingerPrint,
    childIndex: index,
    chainCode: chainCode,
    privateKey: privateKey,
  });

  return derived;
};

/**
 * Derives a child HDPrivateKey from a string path.
 * @param {string} path - The derivation path (e.g. "m/44'/0'/0'")
 * @param {boolean} [nonCompliant] - Whether to use non-compliant derivation
 * @returns {HDPrivateKey} The derived private key
 * @throws {hdErrors.InvalidPath} If the path is invalid
 * @private
 */
HDPrivateKey.prototype._deriveFromString = function (path, nonCompliant) {
  if (!HDPrivateKey.isValidPath(path)) {
    throw new hdErrors.InvalidPath(path);
  }

  var indexes = Derivation.getDerivationIndexes(path);
  var derived = indexes.reduce(function (prev, index) {
    return prev._deriveWithNumber(index, null, nonCompliant);
  }, this);

  return derived;
};

/**
 * Verifies that a given serialized private key in base58 with checksum format
 * is valid.
 *
 * @param {string|Buffer} data - the serialized private key
 * @param {string|Network} [network] - optional, if present, checks that the
 *     network provided matches the network serialized.
 * @return {boolean}
 */
HDPrivateKey.isValidSerialized = function (data, network) {
  return !HDPrivateKey.getSerializedError(data, network);
};

/**
 * Checks what's the error that causes the validation of a serialized private key
 * in base58 with checksum to fail.
 *
 * @param {string|Buffer} data - the serialized private key
 * @param {string|Network} [network] - optional, if present, checks that the
 *     network provided matches the network serialized.
 * @return {Error|null} Returns the validation error, if any, otherwise null.
 */
HDPrivateKey.getSerializedError = function (data, network) {
  if (!(_.isString(data) || Buffer.isBuffer(data))) {
    return new hdErrors.UnrecognizedArgument('Expected string or buffer');
  }
  if (!Base58.validCharacters(data)) {
    return new errors.InvalidB58Char('(unknown)', data);
  }
  try {
    data = Base58Check.decode(data);
  } catch (e) {
    return new errors.InvalidB58Checksum(data);
  }
  if (data.length !== HDPrivateKey.DataLength) {
    return new hdErrors.InvalidLength(data);
  }
  if (!_.isUndefined(network)) {
    var error = HDPrivateKey._validateNetwork(data, network);
    if (error) {
      return error;
    }
  }
  return null;
};

/**
 * Validates if the provided data matches the expected network's extended private key version.
 * @param {Buffer} data - The data buffer to validate (must include version bytes).
 * @param {string|Network} networkArg - Network identifier or Network object to validate against.
 * @returns {Error|null} Returns error if validation fails, otherwise null.
 * @private
 */
HDPrivateKey._validateNetwork = function (data, networkArg) {
  var network = Networks.get(networkArg);
  if (!network) {
    return new errors.InvalidNetworkArgument(networkArg);
  }
  var version = data.slice(0, 4);
  if (version.readUInt32BE(0) !== network.xprivkey) {
    return new errors.InvalidNetwork(version);
  }
  return null;
};

/**
 * Creates an HDPrivateKey instance from a string representation.
 * @param {string} arg - The string to convert to an HDPrivateKey
 * @returns {HDPrivateKey} A new HDPrivateKey instance
 * @throws {Error} If the input is not a valid string
 */
HDPrivateKey.fromString = function (arg) {
  $.checkArgument(_.isString(arg), 'No valid string was provided');
  return new HDPrivateKey(arg);
};

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
HDPrivateKey.fromObject = function (arg) {
  $.checkArgument(_.isObject(arg), 'No valid argument was provided');
  return new HDPrivateKey(arg);
};

/**
 * Builds an HDPrivateKey instance from a JSON string.
 * @private
 * @param {string} arg - JSON string to parse and build from.
 * @returns {HDPrivateKey} The constructed HDPrivateKey instance.
 */
HDPrivateKey.prototype._buildFromJSON = function (arg) {
  return this._buildFromObject(JSON.parse(arg));
};

/**
 * Builds an HDPrivateKey from an object by converting its properties to buffers.
 * Handles type conversion for version, depth, parentFingerPrint, childIndex, chainCode, privateKey, and checksum.
 * @private
 * @param {Object} arg - The source object containing key properties
 * @returns {HDPrivateKey} The constructed HDPrivateKey instance
 */
HDPrivateKey.prototype._buildFromObject = function (arg) {
  // TODO: Type validation
  var buffers = {
    version: arg.network ? JSUtil.integerAsBuffer(Networks.get(arg.network).xprivkey) : arg.version,
    depth: _.isNumber(arg.depth) ? Buffer.from([arg.depth & 0xff]) : arg.depth,
    parentFingerPrint: _.isNumber(arg.parentFingerPrint)
      ? JSUtil.integerAsBuffer(arg.parentFingerPrint)
      : arg.parentFingerPrint,
    childIndex: _.isNumber(arg.childIndex)
      ? JSUtil.integerAsBuffer(arg.childIndex)
      : arg.childIndex,
    chainCode: _.isString(arg.chainCode) ? Buffer.from(arg.chainCode, 'hex') : arg.chainCode,
    privateKey:
      _.isString(arg.privateKey) && JSUtil.isHexa(arg.privateKey)
        ? Buffer.from(arg.privateKey, 'hex')
        : arg.privateKey,
    checksum: arg.checksum
      ? arg.checksum.length
        ? arg.checksum
        : JSUtil.integerAsBuffer(arg.checksum)
      : undefined,
  };
  return this._buildFromBuffers(buffers);
};

/**
 * Builds an HDPrivateKey instance from a serialized Base58Check encoded string.
 * @private
 * @param {string} arg - The Base58Check encoded extended private key (xprivkey)
 * @returns {HDPrivateKey} The instance built from the decoded buffers
 */
HDPrivateKey.prototype._buildFromSerialized = function (arg) {
  var decoded = Base58Check.decode(arg);
  var buffers = {
    version: decoded.slice(HDPrivateKey.VersionStart, HDPrivateKey.VersionEnd),
    depth: decoded.slice(HDPrivateKey.DepthStart, HDPrivateKey.DepthEnd),
    parentFingerPrint: decoded.slice(
      HDPrivateKey.ParentFingerPrintStart,
      HDPrivateKey.ParentFingerPrintEnd,
    ),
    childIndex: decoded.slice(HDPrivateKey.ChildIndexStart, HDPrivateKey.ChildIndexEnd),
    chainCode: decoded.slice(HDPrivateKey.ChainCodeStart, HDPrivateKey.ChainCodeEnd),
    privateKey: decoded.slice(HDPrivateKey.PrivateKeyStart, HDPrivateKey.PrivateKeyEnd),
    checksum: decoded.slice(HDPrivateKey.ChecksumStart, HDPrivateKey.ChecksumEnd),
    xprivkey: arg,
  };
  return this._buildFromBuffers(buffers);
};

/**
 * Generates a new HDPrivateKey instance with a randomly generated seed.
 * @param {Network} network - The network to use for the HDPrivateKey.
 * @returns {HDPrivateKey} A new HDPrivateKey instance with random seed.
 * @private
 */
HDPrivateKey.prototype._generateRandomly = function (network) {
  return HDPrivateKey.fromSeed(Random.getRandomBuffer(64), network);
};

/**
 * Generate a private key from a seed, as described in BIP32
 *
 * @param {string|Buffer} hexa - The entropy hex encoded or buffer of the seed.
 * @param {string} [network] - optional network name.
 * @return HDPrivateKey
 * @static
 */
HDPrivateKey.fromSeed = function (hexa, network) {
  if (JSUtil.isHexaString(hexa)) {
    hexa = Buffer.from(hexa, 'hex');
  }
  if (!Buffer.isBuffer(hexa)) {
    throw new hdErrors.InvalidEntropyArgument(hexa);
  }
  if (hexa.length < MINIMUM_ENTROPY_BITS * BITS_TO_BYTES) {
    throw new hdErrors.InvalidEntropyArgument.NotEnoughEntropy(hexa);
  }
  if (hexa.length > MAXIMUM_ENTROPY_BITS * BITS_TO_BYTES) {
    throw new hdErrors.InvalidEntropyArgument.TooMuchEntropy(hexa);
  }
  var hash = Hash.sha512hmac(hexa, Buffer.from('Bitcoin seed'));

  return new HDPrivateKey({
    network: Networks.get(network) || Networks.defaultNetwork,
    depth: 0,
    parentFingerPrint: 0,
    childIndex: 0,
    privateKey: hash.slice(0, 32),
    chainCode: hash.slice(32, 64),
  });
};

/**
 * Calculates and caches the HD public key from the private key.
 * This is an internal method that lazily computes the public key only when needed.
 * The result is stored in `this._hdPublicKey` to avoid repeated calculations.
 * @private
 */
HDPrivateKey.prototype._calcHDPublicKey = function () {
    var args = _.clone(this._buffers);
    var point = Point.getG().mul(BN.fromBuffer(args.privateKey));
    args.publicKey = Point.pointToCompressed(point);
    args.version = JSUtil.integerAsBuffer(Networks.get(args.version.readUInt32BE(0)).xpubkey);
    args.privateKey = undefined;
    args.checksum = undefined;
    args.xprivkey = undefined;
    return new HDPublicKey(args);
};

/**
 * Converts the HDPrivateKey instance to its corresponding HDPublicKey.
 * @returns {HDPublicKey} The derived HD public key.
 */
HDPrivateKey.prototype.toHDPublicKey = function () {
  return this._hdPublicKey;
};


/**
 * Returns the private key associated with this HD private key.
 * @returns {PrivateKey} The private key instance.
 */
HDPrivateKey.prototype.toPrivateKey = function () {
  return this.privateKey;
};


/**
 * Receives a object with buffers in all the properties and populates the
 * internal structure
 *
 * @param {Object} arg - The buffers object containing all the necessary buffers
 * @param {buffer.Buffer} arg.version - Version buffer
 * @param {buffer.Buffer} arg.depth - Depth buffer
 * @param {buffer.Buffer} arg.parentFingerPrint - Parent FingerPrint buffer
 * @param {buffer.Buffer} arg.childIndex - Child Index buffer
 * @param {buffer.Buffer} arg.chainCode - Chain Code buffer
 * @param {buffer.Buffer} arg.privateKey - Private Key buffer
 * @param {buffer.Buffer} [arg.checksum] - Checksum buffer (optional)
 * @param {string} [arg.xprivkey] - if set, don't recalculate the base58
 *      representation
 * @return {HDPrivateKey} this
 * @private
 */
HDPrivateKey.prototype._buildFromBuffers = function (arg) {
  HDPrivateKey._validateBufferArguments(arg);

  JSUtil.defineImmutable(this, {
    _buffers: arg,
  });

  var sequence = [
    arg.version,
    arg.depth,
    arg.parentFingerPrint,
    arg.childIndex,
    arg.chainCode,
    Buffer.alloc(1),
    arg.privateKey,
  ];
  var concat = Buffer.concat(sequence);
  if (!arg.checksum || !arg.checksum.length) {
    arg.checksum = Base58Check.checksum(concat);
  } else {
    if (arg.checksum.toString() !== Base58Check.checksum(concat).toString()) {
      throw new errors.InvalidB58Checksum(concat);
    }
  }

  var network = Networks.get(arg.version.readUInt32BE(0));
  var xprivkey;
  xprivkey = Base58Check.encode(Buffer.concat(sequence));
  arg.xprivkey = Buffer.from(xprivkey);

  var privateKey = new PrivateKey(BN.fromBuffer(arg.privateKey), network);
  var publicKey = privateKey.toPublicKey();
  var size = HDPrivateKey.ParentFingerPrintSize;
  var fingerPrint = Hash.sha256ripemd160(publicKey.toBuffer()).slice(0, size);

  /** @type {string} - The base58 encoding of the key*/
  this.xprivkey = xprivkey;
  /** @type {Network} - The network of the key*/
  this.network = network;
  /** @type {number} - depth of the HD key in the hierarchy*/
  this.depth = arg.depth[0]
  /** @type {PrivateKey} */
  this.privateKey = privateKey;
  /** @type {PublicKey} */
  this.publicKey = publicKey;
  /** @type {Buffer} */
  this.fingerPrint = fingerPrint;

  JSUtil.defineImmutable(this, {
    xprivkey: xprivkey,
    network: network,
    depth: arg.depth[0],
    privateKey: privateKey,
    publicKey: publicKey,
    fingerPrint: fingerPrint,
  });

  this._hdPublicKey = this._calcHDPublicKey();
  return this;
};

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
HDPrivateKey._validateBufferArguments = function (arg) {
  var checkBuffer = function (name, size) {
    var buff = arg[name];
    assert(Buffer.isBuffer(buff), name + ' argument is not a buffer');
    assert(
      buff.length === size,
      name + ' has not the expected size: found ' + buff.length + ', expected ' + size,
    );
  };
  checkBuffer('version', HDPrivateKey.VersionSize);
  checkBuffer('depth', HDPrivateKey.DepthSize);
  checkBuffer('parentFingerPrint', HDPrivateKey.ParentFingerPrintSize);
  checkBuffer('childIndex', HDPrivateKey.ChildIndexSize);
  checkBuffer('chainCode', HDPrivateKey.ChainCodeSize);
  checkBuffer('privateKey', HDPrivateKey.PrivateKeySize);
  if (arg.checksum && arg.checksum.length) {
    checkBuffer('checksum', HDPrivateKey.CheckSumSize);
  }
};

/**
 * Returns the extended private key string representation of this HDPrivateKey.
 *  (a string starting with "xprv...")
 * @returns {string} The extended private key in base58 string format.
 */
HDPrivateKey.prototype.toString = function () {
  return this.xprivkey;
};

/**
 * Returns the console representation of this extended private key.
 * @return string
 */
HDPrivateKey.prototype.inspect = function () {
  return '<HDPrivateKey: ' + this.xprivkey + '>';
};


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

HDPrivateKey.prototype.toObject = HDPrivateKey.prototype.toJSON = function toObject() {
  return {
    network: Networks.get(this._buffers.version.readUInt32BE(0), 'xprivkey').name,
    depth: this._buffers.depth[0],
    fingerPrint: this.fingerPrint.readUInt32BE(0),
    parentFingerPrint: this._buffers.parentFingerPrint.readUInt32BE(0),
    childIndex: this._buffers.childIndex.readUInt32BE(0),
    chainCode: this._buffers.chainCode.toString('hex'),
    privateKey: this.privateKey.toBuffer().toString('hex'),
    checksum: this._buffers.checksum.readUInt32BE(0),
    xprivkey: this.xprivkey,
  };
};

/**
 * Build a HDPrivateKey from a buffer
 *
 * @param {Buffer} buf - Buffer for the xprivkey.
 * @return {HDPrivateKey} A new HDPrivateKey instance created from the buffer.
 * @throws {Error} If the buffer is not a valid serialized HDPrivateKey.
 */
HDPrivateKey.fromBuffer = function (buf) {
  return new HDPrivateKey(buf.toString());
};

/**
 * Build a HDPrivateKey from a hex string
 *
 * @param {string} hex
 * @return {HDPrivateKey}
 */
HDPrivateKey.fromHex = function (hex) {
  return HDPrivateKey.fromBuffer(Buffer.from(hex, 'hex'));
};

/**
 * Returns a buffer representation of the HDPrivateKey
 *
 * @return {string}
 */
HDPrivateKey.prototype.toBuffer = function () {
  return Buffer.from(this.toString());
};

/**
 * Returns a hex string representation of the HDPrivateKey
 *
 * @return {string}
 */
HDPrivateKey.prototype.toHex = function () {
  return this.toBuffer().toString('hex');
};

/**
 * Sets the default depth for hierarchical deterministic (HD) private keys.
 * @type {number}
 * @default 0
 */
HDPrivateKey.DefaultDepth = 0;
/**
 * Sets the default fingerprint value for HDPrivateKey instances.
 * @type {number}
 * @default 0
 */
HDPrivateKey.DefaultFingerprint = 0;
/**
 * Default child index used for deriving child keys in the HD (Hierarchical Deterministic) key derivation path.
 * @type {number}
 * @default 0
 */
HDPrivateKey.DefaultChildIndex = 0;
/**
 * Sets the hardened derivation flag for HDPrivateKey (inherited from Derivation.Hardened).
 * @type {number}
 */
HDPrivateKey.Hardened = Derivation.Hardened;
/**
 * Maximum index value for HD private keys (2 * Hardened value).
 * @type {number}
 */
HDPrivateKey.MaxIndex = 2 * HDPrivateKey.Hardened;

/**
 * Sets the root element alias for HDPrivateKey to match Derivation's root element alias.
 * @type {string}
 */
HDPrivateKey.RootElementAlias = Derivation.RootElementAlias;

HDPrivateKey.VersionSize = 4;
HDPrivateKey.DepthSize = 1;
HDPrivateKey.ParentFingerPrintSize = 4;
HDPrivateKey.ChildIndexSize = 4;
HDPrivateKey.ChainCodeSize = 32;
HDPrivateKey.PrivateKeySize = 32;
HDPrivateKey.CheckSumSize = 4;

HDPrivateKey.DataLength = 78;
HDPrivateKey.SerializedByteSize = 82;

HDPrivateKey.VersionStart = 0;
HDPrivateKey.VersionEnd = 4;
HDPrivateKey.DepthStart = 4;
HDPrivateKey.DepthEnd = 5;
HDPrivateKey.ParentFingerPrintStart = 5;
HDPrivateKey.ParentFingerPrintEnd = 9;
HDPrivateKey.ChildIndexStart = 9;
HDPrivateKey.ChildIndexEnd = 13;
HDPrivateKey.ChainCodeStart = 13;
HDPrivateKey.ChainCodeEnd = 45;
HDPrivateKey.PrivateKeyStart = 46;
HDPrivateKey.PrivateKeyEnd = 78;
HDPrivateKey.ChecksumStart = 78;
HDPrivateKey.ChecksumEnd = 82;

assert(HDPrivateKey.ChecksumEnd === HDPrivateKey.SerializedByteSize);

module.exports = HDPrivateKey;
