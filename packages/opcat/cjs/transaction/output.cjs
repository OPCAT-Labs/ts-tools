'use strict';

var _ = require('../util/_.cjs');
var BN = require('../crypto/bn.cjs');
var JSUtil = require('../util/js.cjs');
var BufferWriter = require('../encoding/bufferwriter.cjs');
var Varint = require('../encoding/varint.cjs');
var Script = require('../script/index.cjs');
var $ = require('../util/preconditions.cjs');
var errors = require('../errors/index.cjs');
var Hash = require('../crypto/hash.cjs')

var MAX_SAFE_INTEGER = 0x1fffffffffffff;

/**
 * Represents a transaction output in the Bitcoin protocol.
 * @constructor
 * @param {Object} args - The arguments to create an Output.
 * @param {number} args.satoshis - The amount in satoshis.
 * @param {Buffer|string|Script} args.script - The output script (either as Buffer or hex string).
 * @param {Buffer|string} [args.data] - Additional data associated with the output.
 * @throws {TypeError} If arguments are invalid or unrecognized.
 */
function Output(args) {
  if (!(this instanceof Output)) {
    return new Output(args);
  }
  if (_.isObject(args)) {
    this.satoshis = args.satoshis;
    if (Buffer.isBuffer(args.script)) {
      this.setScriptFromBuffer(args.script);
    } else {
      var script;
      if (_.isString(args.script) && JSUtil.isHexa(args.script)) {
        script = Buffer.from(args.script, 'hex');
      } else {
        script = args.script;
      }
      this.setScript(script);
    }
    this.setData(args.data)
  } else {
    throw new TypeError('Unrecognized argument for Output');
  }
}
/**
 * Gets or sets the script associated with this Output instance.
 * @memberof Output.prototype
 * @name script
 */
Object.defineProperty(Output.prototype, 'script', {
  configurable: false,
  enumerable: true,
  get: function () {
    return this._script;
  },
});

/**
 * Gets or sets the transaction output data.
 * @memberof Output.prototype
 * @name data
 * @type {Buffer|string}
 */
Object.defineProperty(Output.prototype, 'data', {
  configurable: false,
  enumerable: true,
  get: function () {
    return this._data;
  },
});
/**
 * Gets the satoshis value of the Output instance.
 * @memberof Output.prototype
 * @name satoshis
 * @type {BN|string|number}
 */
Object.defineProperty(Output.prototype, 'satoshis', {
  configurable: false,
  enumerable: true,
  get: function () {
    return this._satoshis;
  },
  set: function (num) {
    if (num instanceof BN) {
      this._satoshisBN = num;
      this._satoshis = num.toNumber();
    } else if (_.isString(num)) {
      this._satoshis = parseInt(num);
      this._satoshisBN = BN.fromNumber(this._satoshis);
    } else {
      $.checkArgument(JSUtil.isNaturalNumber(num), 'Output satoshis is not a natural number');
      this._satoshisBN = BN.fromNumber(num);
      this._satoshis = num;
    }
    $.checkState(JSUtil.isNaturalNumber(this._satoshis), 'Output satoshis is not a natural number');
  },
});

/**
 * Checks if the satoshis value in this output is invalid.
 * @returns {string|boolean} Returns an error message string if invalid (satoshis exceed max safe integer, 
 *                           corrupted value, or negative), otherwise returns false.
 */
Output.prototype.invalidSatoshis = function () {
  if (this._satoshis > MAX_SAFE_INTEGER) {
    return 'transaction txout satoshis greater than max safe integer';
  }
  if (this._satoshis !== this._satoshisBN.toNumber()) {
    return 'transaction txout satoshis has corrupted value';
  }
  if (this._satoshis < 0) {
    return 'transaction txout negative';
  }
  return false;
};

/**
 * Gets the satoshis value as a BN (BigNumber) instance.
 * @memberof Output.prototype
 * @name satoshisBN
 * @type {BN}
 */
Object.defineProperty(Output.prototype, 'satoshisBN', {
  configurable: false,
  enumerable: true,
  get: function () {
    return this._satoshisBN;
  },
  set: function (num) {
    this._satoshisBN = num;
    this._satoshis = num.toNumber();
    $.checkState(JSUtil.isNaturalNumber(this._satoshis), 'Output satoshis is not a natural number');
  },
});

/**
 * Converts the Output instance to a plain object representation.
 * The resulting object includes satoshis, script (as hex string), and data (as hex string).
 * @returns {Object} - An object with satoshis, script, and data properties.
 */
Output.prototype.toObject = Output.prototype.toJSON = function toObject() {
  var obj = {
    satoshis: this.satoshis,
  };
  obj.script = this._script.toBuffer().toString('hex');
  obj.data = this._data.toString('hex')
  return obj;
};

/**
 * Sets the output data.
 * @param {Buffer|string} data - The data to set. Can be a Buffer or hex string.
 * @throws {TypeError} If data is not a Buffer or valid hex string.
 */
Output.prototype.setData = function (data) {
  if (!data) {
    this._data = Buffer.from([])
    return;
  }
  if (Buffer.isBuffer(data)) {
    this._data = data
  } else if (_.isString(data) && JSUtil.isHexa(data)) {
    this._data = Buffer.from(data, 'hex')
  } else {
    throw new TypeError('Invalid argument type: data for output.setData')
  }
}

/**
 * Creates an Output instance from a plain JavaScript object.
 * @param {Object} data - The input object to convert to an Output
 * @returns {Output} A new Output instance
 * @static
 */
Output.fromObject = function (data) {
  return new Output(data);
};

/**
 * Sets the script for this output from a buffer.
 * @param {Buffer} buffer - The buffer containing the script data.
 * @throws {errors.Script.InvalidBuffer} If the buffer is invalid.
 */
Output.prototype.setScriptFromBuffer = function (buffer) {
  try {
    this._script = Script.fromBuffer(buffer);
    this._script._isOutput = true;
  } catch (e) {
    if (e instanceof errors.Script.InvalidBuffer) {
      this._script = null;
    } else {
      throw e;
    }
  }
};

/**
 * Sets the script for this output.
 * @param {Script|string|Buffer} script - The script to set, which can be a Script instance, hex string, or Buffer.
 * @returns {Output} Returns the output instance for chaining.
 * @throws {TypeError} Throws if the script type is invalid.
 */
Output.prototype.setScript = function (script) {
  if (script instanceof Script) {
    this._script = script;
    this._script._isOutput = true;
  } else if (_.isString(script)) {
    this._script = Script.fromString(script);
    this._script._isOutput = true;
  } else if (Buffer.isBuffer(script)) {
    this.setScriptFromBuffer(script);
  } else {
    throw new TypeError('Invalid argument type: script');
  }
  return this;
};

/**
 * Returns a human-readable string representation of the Output object.
 * Format: '<Output (satoshis sats) scriptString>'
 * @returns {string} Formatted string showing satoshis and script inspection result
 */
Output.prototype.inspect = function () {
  var scriptStr;
  if (this.script) {
    scriptStr = this.script.inspect();
  }
  return '<Output (' + this.satoshis + ' sats) ' + scriptStr + '>';
};

/**
 * Creates an Output instance from a BufferReader.
 * @param {BufferReader} br - The buffer reader containing output data
 * @returns {Output} A new Output instance
 * @throws {TypeError} If the buffer contains unrecognized output format
 * @static
 */
Output.fromBufferReader = function (br) {
  var obj = {}
  obj.satoshis = br.readUInt64LEBN()
  var scriptSize = br.readVarintNum()
  if (scriptSize !== 0) {
    if (br.remaining() < scriptSize) {
      throw new TypeError('Unrecognized Output')
    }
    obj.script = br.read(scriptSize)
  } else {
    obj.script = Buffer.from([])
  }
  var dataSize = br.readVarintNum()
  if (dataSize !== 0) {
    if (br.remaining() < dataSize) {
      throw new TypeError('Unrecognized Output')
    }
    obj.data = br.read(dataSize)
  } else {
    obj.data = Buffer.from([])
  }
  return new Output(obj)
}

/**
 * Converts the Output instance to a buffer writer format.
 * @param {boolean} hashScriptPubkey - If true, hashes script and data with SHA256; otherwise writes them directly.
 * @param {BufferWriter} [writer] - Optional BufferWriter instance. If not provided, a new one is created.
 * @returns {BufferWriter} The buffer writer containing the serialized output data.
 */
Output.prototype.toBufferWriter = function (hashScriptPubkey, writer) {
  $.checkArgument(typeof hashScriptPubkey === 'boolean', 'hashScriptSig should be boolean')
  if (!writer) {
    writer = new BufferWriter();
  }
  writer.writeUInt64LEBN(this._satoshisBN);
  var script = this._script.toBuffer();
  var data = this._data
  if(hashScriptPubkey) {
    writer.write(Hash.sha256(script))
    writer.write(Hash.sha256(data))
  } else {
    writer.writeVarintNum(script.length);
    writer.write(script);
    writer.writeVarintNum(data.length)
    writer.write(data)
  }


  return writer
};

/**
 * Calculates the total size of the output in bytes.
 * Includes the script size, data size, and their respective varint sizes,
 * plus a fixed 8-byte overhead.
 * 8    value
 * ???  script+data size (VARINT)
 * script size
 * data size
 * @returns {number} The total output size in bytes.
 */
Output.prototype.getSize = function () {
  var scriptSize = this.script.toBuffer().length;
  var dataSize = this.data.length
  var varintSize = Varint(scriptSize).toBuffer().length + Varint(dataSize).toBuffer().length
  return 8 + varintSize + scriptSize + dataSize
};

/**
 * Creates a shallow clone of the Output instance.
 * @returns {Output} A new Output instance with the same properties as the original.
 */
Output.prototype.clone = function () {
  return Output.fromObject(this.toObject());
}

module.exports = Output;
