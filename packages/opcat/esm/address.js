'use strict';

import _ from './util/_.js';
import $ from './util/preconditions.js';
import Base58Check from './encoding/base58check.js';
import Networks from './networks.js';
import Hash from './crypto/hash.js';
import JSUtil from './util/js.js';

/**
 * Instantiate an address from an address String or Buffer, a public key hash Buffer,
 * or a {@link PublicKey} Buffer.
 *
 * This is an immutable class, and if the first parameter provided to this constructor is an
 * `Address` instance, the same argument will be returned.
 *
 * An address has two key properties: `network` and `type`. The type is either
 * `Address.PayToPublicKeyHash` (value is the `'pubkeyhash'` string).
 * The network is an instance of {@link Network}.
 * You can quickly check whether an address is of a given kind by using the methods
 * `isPayToPublicKeyHash`
 *
 * @example
 * ```javascript
 * // validate that an input field is valid
 * var error = Address.getValidationError(input, 'testnet');
 * if (!error) {
 *   var address = Address(input, 'testnet');
 * } else {
 *   // invalid network or checksum (typo?)
 *   var message = error.messsage;
 * }
 *
 * // get an address from a public key
 * var address = Address(publicKey, 'testnet').toString();
 * ```
 *
 * @param {*} data - The encoded data in various formats
 * @param {Network|String|number} [network] - The network: 'livenet' or 'testnet'
 * @param {string} [type] - The type of address: 'pubkey'
 * @returns {Address} A new valid and frozen instance of an Address
 * @constructor
 */
function Address(data, network, type) {
  if (!(this instanceof Address)) {
    return new Address(data, network, type);
  }

  if (data instanceof Address) {
    // Immutable instance
    return data;
  }

  $.checkArgument(
    data,
    'First argument is required, please include address data.',
    'guide/address.html',
  );

  if (network && !Networks.get(network)) {
    throw new TypeError('Second argument must be "livenet", "testnet", or "regtest".');
  }

  if (type && type !== Address.PayToPublicKeyHash) {
    throw new TypeError('Third argument must be "pubkeyhash".');
  }

  var info = this._classifyArguments(data, network, type);

  // set defaults if not set
  info.network = info.network || Networks.get(network) || Networks.defaultNetwork;
  info.type = info.type || type || Address.PayToPublicKeyHash;

  JSUtil.defineImmutable(this, {
    hashBuffer: info.hashBuffer,
    network: info.network,
    type: info.type,
  });

  return this;
}

/**
 * Gets the hash buffer of the Address instance.
 * @memberof Address.prototype
 * @type {Buffer}
 * @readonly
 */
Object.defineProperty(Address.prototype, 'hashBuffer', {
  enumerable: true,
  configurable: false,
  get: function () {
    return this.hashBuffer;
  },
});

/**
 * Gets or sets the network associated with this Address instance.
 * @memberof Address.prototype
 * @type {Network}
 * @readonly
 */
Object.defineProperty(Address.prototype, 'network', {
  enumerable: true,
  configurable: false,
  get: function () {
    return this.network;
  },
});

/**
 * Gets the address type (e.g. 'pubkeyhash').
 * @memberof Address.prototype
 * @type {string}
 * @readonly
 */
Object.defineProperty(Address.prototype, 'type', {
  enumerable: true,
  configurable: false,
  get: function () {
    return this.type;
  },
});

/**
 * Internal function used to split different kinds of arguments of the constructor
 * @param {Buffer|Uint8Array|string|Object} data - The encoded data in various formats
 * @param {Network|string} [network] - The network: 'livenet' or 'testnet'
 * @param {string} [type] - The type of address: 'pubkey'
 * @returns {Object} An "info" object with "type", "network", and "hashBuffer"
 * @private
 */
Address.prototype._classifyArguments = function (data, network, type) {
  // transform and validate input data
  if ((data instanceof Buffer || data instanceof Uint8Array) && data.length === 20) {
    return Address._transformHash(data);
  } else if ((data instanceof Buffer || data instanceof Uint8Array) && data.length === 21) {
    return Address._transformBuffer(data, network, type);
  } else if ((data instanceof Buffer || data instanceof Uint8Array) && (data.length === 33 || data.length === 65)) {
    return Address._transformPublicKey(data);
  } else if (typeof data === 'string') {
    return Address._transformString(data, network, type);
  } else if (_.isObject(data)) {
    return Address._transformObject(data);
  } else {
    throw new TypeError('First argument is an unrecognized data format.');
  }
};

/**
 * PayToPublicKeyHash address type identifier.
 * @type {string}
 * @static
 */
Address.PayToPublicKeyHash = 'pubkeyhash';

/**
 * @param {Buffer} hash - An instance of a hash Buffer
 * @returns {Object} An object with keys: hashBuffer
 * @private
 */
Address._transformHash = function (hash) {
  var info = {};
  if (!(hash instanceof Buffer) && !(hash instanceof Uint8Array)) {
    throw new TypeError('Address supplied is not a buffer.');
  }
  if (hash.length !== 20) {
    throw new TypeError('Address hashbuffers must be exactly 20 bytes.');
  }
  info.hashBuffer = hash;
  return info;
};

/**
 * Deserializes an address serialized through `Address#toObject()`
 * @param {Object} data
 * @param {string} data.hash - the hash that this address encodes
 * @param {string} data.type - either 'pubkeyhash' or 'scripthash'
 * @param {Network=} data.network - the name of the network associated
 * @return {Address}
 * @private
 */
Address._transformObject = function (data) {
  $.checkArgument(data.hash || data.hashBuffer, 'Must provide a `hash` or `hashBuffer` property');
  $.checkArgument(data.type, 'Must provide a `type` property');
  return {
    hashBuffer: data.hash ? Buffer.from(data.hash, 'hex') : data.hashBuffer,
    network: Networks.get(data.network) || Networks.defaultNetwork,
    type: data.type,
  };
};

/**
 * Internal function to discover the network and type based on the first data byte
 *
 * @param {Buffer} buffer - An instance of a hex encoded address Buffer
 * @returns {Object} An object with keys: network and type
 * @private
 */
Address._classifyFromVersion = function (buffer) {
  var version = {};

  var pubkeyhashNetwork = Networks.get(buffer[0], 'pubkeyhash');

  if (pubkeyhashNetwork) {
    version.network = pubkeyhashNetwork;
    version.type = Address.PayToPublicKeyHash;
  } 

  return version;
};

/**
 * Internal function to transform a bitcoin address buffer
 *
 * @param {Buffer} buffer - An instance of a hex encoded address Buffer
 * @param {string=} network - The network: 'livenet' or 'testnet'
 * @param {string=} type - The type: 'pubkeyhash' or 'scripthash'
 * @returns {Object} An object with keys: hashBuffer, network and type
 * @private
 */
Address._transformBuffer = function (buffer, network, type) {
  var info = {};
  if (!(buffer instanceof Buffer) && !(buffer instanceof Uint8Array)) {
    throw new TypeError('Address supplied is not a buffer.');
  }
  if (buffer.length !== 1 + 20) {
    throw new TypeError('Address buffers must be exactly 21 bytes.');
  }

  var networkObj = Networks.get(network);
  var bufferVersion = Address._classifyFromVersion(buffer);

  if (network && !networkObj) {
    throw new TypeError('Unknown network');
  }

  if (!bufferVersion.network || (networkObj && networkObj !== bufferVersion.network)) {
    // console.log(bufferVersion)
    throw new TypeError('Address has mismatched network type.');
  }

  if (!bufferVersion.type || (type && type !== bufferVersion.type)) {
    throw new TypeError('Address has mismatched type.');
  }

  info.hashBuffer = buffer.slice(1);
  info.network = bufferVersion.network;
  info.type = bufferVersion.type;
  return info;
};

/**
 * Internal function to transform a {@link PublicKey}
 *
 * @param {PublicKey} pubkey - An instance of PublicKey
 * @returns {Object} An object with keys: hashBuffer, type
 * @private
 */
Address._transformPublicKey = function (pubkey) {
  var info = {};
  if (!(pubkey instanceof Buffer) && !(pubkey instanceof Uint8Array) || (pubkey.length !== 33 && pubkey.length !== 65)) {
    throw new TypeError('Pubkey supplied is not a buffer with 33 or 65 bytes.');
  }
  info.hashBuffer = Hash.sha256ripemd160(pubkey);
  info.type = Address.PayToPublicKeyHash;
  return info;
};

/**
 * Internal function to transform a bitcoin cash address string
 *
 * @param {string} data
 * @param {String|Network=} network - either a Network instance, 'livenet', or 'testnet'
 * @param {string=} type - The type: 'pubkeyhash'
 * @returns {Object} An object with keys: hashBuffer, network and type
 * @private
 */
Address._transformString = function (data, network, type) {
  if (typeof data !== 'string') {
    throw new TypeError('data parameter supplied is not a string.');
  }
  if (data.length < 27) {
    throw new Error('Invalid Address string provided');
  }
  data = data.trim();
  var networkObj = Networks.get(network);

  if (network && !networkObj) {
    throw new TypeError('Unknown network');
  }

  var addressBuffer = Base58Check.decode(data);
  return Address._transformBuffer(addressBuffer, network, type);
};

/**
 * Instantiate an address from a PublicKey buffer
 *
 * @param {Buffer} data - A buffer of the public key
 * @param {String|Network} network - either a Network instance, 'livenet', or 'testnet'
 * @returns {Address} A new valid and frozen instance of an Address
 */
Address.fromPublicKey = function (data, network) {
  var info = Address._transformPublicKey(data);
  network = network || Networks.defaultNetwork;
  return new Address(info.hashBuffer, network, info.type);
};


/**
 * Instantiate an address from a ripemd160 public key hash
 *
 * @param {Buffer} hash - An instance of buffer of the hash
 * @param {String|Network} network - either a Network instance, 'livenet', or 'testnet'
 * @returns {Address} A new valid and frozen instance of an Address
 */
Address.fromPublicKeyHash = function (hash, network) {
  var info = Address._transformHash(hash);
  return new Address(info.hashBuffer, network, Address.PayToPublicKeyHash);
};


/**
 * Instantiate an address from a bitcoin address buffer
 *
 * @param {Buffer} buffer - An instance of buffer of the address
 * @param {String|Network=} network - either a Network instance, 'livenet', or 'testnet'
 * @param {string=} type - The type of address: 'pubkey'
 * @returns {Address} A new valid and frozen instance of an Address
 */
Address.fromBuffer = function (buffer, network, type) {
  var info = Address._transformBuffer(buffer, network, type);
  return new Address(info.hashBuffer, info.network, info.type);
};

/**
 * Creates an Address instance from a hex string.
 * @param {string} hex - The hex string representation of the address.
 * @param {Network} network - The network type (e.g., 'mainnet', 'testnet').
 * @param {AddressType} [type] - Optional address type.
 * @returns {Address} The Address instance created from the hex string.
 */
Address.fromHex = function (hex, network, type) {
  return Address.fromBuffer(Buffer.from(hex, 'hex'), network, type);
};

/**
 * Instantiate an address from an address string
 *
 * @param {string} str - An string of the bitcoin address
 * @param {String|Network=} network - either a Network instance, 'livenet', or 'testnet'
 * @param {string=} type - The type of address: 'pubkey'
 * @returns {Address} A new valid and frozen instance of an Address
 */
Address.fromString = function (str, network, type) {
  var info = Address._transformString(str, network, type);
  return new Address(info.hashBuffer, info.network, info.type);
};

/**
 * Instantiate an address from an Object
 *
 * @param {string} json - An JSON string or Object with keys: hash, network and type
 * @returns {Address} A new valid instance of an Address
 */
Address.fromObject = function fromObject(obj) {
  $.checkState(
    JSUtil.isHexa(obj.hash),
    'Unexpected hash property, "' + obj.hash + '", expected to be hex.',
  );
  var hashBuffer = Buffer.from(obj.hash, 'hex');
  return new Address(hashBuffer, obj.network, obj.type);
};

/**
 * Will return a validation error if exists
 *
 * @example
 * ```javascript
 * // a network mismatch error
 * var error = Address.getValidationError('15vkcKf7gB23wLAnZLmbVuMiiVDc1Nm4a2', 'testnet');
 * ```
 *
 * @param {string} data - The encoded data
 * @param {String|Network} network - either a Network instance, 'livenet', or 'testnet'
 * @param {string} type - The type of address: 'pubkey'
 * @returns {null|Error} The corresponding error message
 */
Address.getValidationError = function (data, network, type) {
  var error;
  try {
    new Address(data, network, type);
  } catch (e) {
    error = e;
  }
  return error;
};

/**
 * Will return a boolean if an address is valid
 *
 * @example
 * ```javascript
 * assert(Address.isValid('15vkcKf7gB23wLAnZLmbVuMiiVDc1Nm4a2', 'livenet'));
 * ```
 *
 * @param {string} data - The encoded data
 * @param {String|Network} network - either a Network instance, 'livenet', or 'testnet'
 * @param {string} type - The type of address: 'pubkey'
 * @returns {boolean} The corresponding error message
 */
Address.isValid = function (data, network, type) {
  return !Address.getValidationError(data, network, type);
};

/**
 * Returns true if an address is of pay to public key hash type
 * @return boolean
 */
Address.prototype.isPayToPublicKeyHash = function () {
  return this.type === Address.PayToPublicKeyHash;
};

/**
 * Will return a buffer representation of the address
 *
 * @returns {Buffer} Bitcoin address buffer
 */
Address.prototype.toBuffer = function () {
  var version = Buffer.from([this.network[this.type]]);
  var buf = Buffer.concat([version, this.hashBuffer]);
  return buf;
};

/**
 * Converts the address to a hexadecimal string representation.
 * @returns {string} The hexadecimal string representation of the address.
 */
Address.prototype.toHex = function () {
  return this.toBuffer().toString('hex');
};

/**
 * Converts the address to a publickey hash string representation.
 * @returns {string} The hexadecimal string of the publickey hash buffer.
 */
Address.prototype.toPublickeyHash = function () {
  return this.hashBuffer.toString('hex');
};

/**
 * @returns {Object} A plain object with the address information
 */
Address.prototype.toObject = Address.prototype.toJSON = function toObject() {
  return {
    hash: this.hashBuffer.toString('hex'),
    type: this.type,
    network: this.network.toString(),
  };
};

/**
 * Will return a string formatted for the console
 *
 * @returns {string} Bitcoin address
 */
Address.prototype.inspect = function () {
  return (
    '<Address: ' + this.toString() + ', type: ' + this.type + ', network: ' + this.network + '>'
  );
};

/**
 * Will return a the base58 string representation of the address
 *
 * @returns {string} Bitcoin address
 */
Address.prototype.toString = function () {
  return Base58Check.encode(this.toBuffer());
};

export default Address;
