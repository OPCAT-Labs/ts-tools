'use strict';

import BufferWriter from './bufferwriter.js';
import BufferReader from './bufferreader.js';
import BN from '../crypto/bn.js';

/**
 * Creates a Varint instance from various input types.
 * @constructor
 * @param {Buffer|number|BN|{buf: Buffer}} buf - Input can be a Buffer, number, BN instance, or object with buffer properties.
 * @returns {Varint} New Varint instance when called without `new`.
 */
function Varint(buf) {
  if (!(this instanceof Varint)) {
    return new Varint(buf);
  }
  if (Buffer.isBuffer(buf)) {
    this.buf = buf;
  } else if (typeof buf === 'number') {
    var num = buf;
    this.fromNumber(num);
  } else if (buf instanceof BN) {
    var bn = buf;
    this.fromBN(bn);
  } else if (buf) {
    var obj = buf;
    this.set(obj);
  }
}

/**
 * Sets the buffer for the Varint instance.
 * @param {Object} obj - The object containing the buffer to set.
 * @param {Buffer} [obj.buf] - The buffer to assign. If not provided, keeps the current buffer.
 * @returns {Varint} The Varint instance for chaining.
 */
Varint.prototype.set = function (obj) {
  this.buf = obj.buf || this.buf;
  return this;
};

/**
 * Converts a hex string to a Varint buffer and updates the instance.
 * @param {string} str - Hex string to convert.
 * @returns {Varint} The updated Varint instance.
 */
Varint.prototype.fromString = function (str) {
  this.set({
    buf: Buffer.from(str, 'hex'),
  });
  return this;
};

/**
 * Converts the Varint buffer to a hexadecimal string representation.
 * @returns {string} Hexadecimal string of the buffer.
 */
Varint.prototype.toString = function () {
  return this.buf.toString('hex');
};

/**
 * Sets the internal buffer to the provided buffer and returns the instance.
 * @param {Buffer} buf - The buffer to set as the internal buffer.
 * @returns {Varint} The instance for chaining.
 */
Varint.prototype.fromBuffer = function (buf) {
  this.buf = buf;
  return this;
};

/**
 * Reads a varint from a buffer reader and stores it in the instance.
 * @param {BufferReader} br - The buffer reader instance to read from.
 * @returns {Varint} The current Varint instance for chaining.
 */
Varint.prototype.fromBufferReader = function (br) {
  this.buf = br.readVarintBuf();
  return this;
};

/**
 * Converts a BigNumber (BN) to a varint and stores it in the buffer.
 * @param {BN} bn - The BigNumber to convert to varint format.
 * @returns {Varint} Returns the Varint instance for chaining.
 */
Varint.prototype.fromBN = function (bn) {
  var bw = new BufferWriter();
  this.buf = bw.writeVarintBN(bn).toBuffer();
  return this;
};

/**
 * Converts a number to a varint and stores it in the buffer.
 * @param {number} num - The number to convert to varint format.
 * @returns {Varint} Returns the instance for chaining.
 */
Varint.prototype.fromNumber = function (num) {
  var bw = new BufferWriter();
  this.buf = bw.writeVarintNum(num).toBuffer();
  return this;
};

/**
 * Returns the internal buffer of the Varint instance.
 * @returns {Buffer} The internal buffer.
 */
Varint.prototype.toBuffer = function () {
  return this.buf;
};

/**
 * Converts the Varint buffer to a BigNumber (BN) instance.
 * @returns {BN} The BigNumber representation of the Varint buffer.
 */
Varint.prototype.toBN = function () {
  return BufferReader(this.buf).readVarintBN();
};


/**
 * Converts the Varint buffer to a number.
 * @returns {number} The numeric representation of the Varint buffer.
 */
Varint.prototype.toNumber = function () {
  return BufferReader(this.buf).readVarintNum();
};

export default Varint;
