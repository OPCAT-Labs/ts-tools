'use strict';

import assert from 'assert';
import writeU8LE from '../script/write-u8-le.js';
import writeU16LE from '../script/write-u16-le.js';
import writeU32LE from '../script/write-u32-le.js';
import writeI32LE from '../script/write-i32-le.js';
import writeVarint from '../script/write-varint.js';

/**
 * BufferWriter is a utility class for efficiently writing and concatenating buffers.
 * It provides methods for writing various numeric types in both little-endian and big-endian formats,
 * as well as variable-length integers (varints). The class maintains an internal array of buffers
 * and can efficiently concatenate them into a single buffer when needed.
 * 
 * @class
 * @example
 * const writer = new BufferWriter();
 * writer.writeUInt32LE(1234).writeUInt16BE(5678);
 * const result = writer.toBuffer();
 */
class BufferWriter {
  /**
   * Initializes a new BufferWriter instance.
   * @param {{buffers?: Buffer[], bufs?: Buffer[] }} [obj] - Optional object to set initial buffer content. If not provided,
   *                         creates an empty buffer writer with empty buffers array and length 0.
   */
  constructor(obj) {
    if (obj) {
      this.set(obj);
    } else {
      this.buffers = [];
      this.length = 0;
    }
  }

  /**
   * Appends a buffer to the internal buffers array and updates the total length.
   * @param {Buffer} buffer - The buffer to append.
   * @returns {this} Returns the instance for chaining.
   */
  write(buffer) {
    this.buffers.push(buffer);
    this.length += buffer.length;
    return this;
  }

  /**
   * Sets the internal buffers and calculates total length.
   * @param {{buffers?: Buffer[], bufs?: Buffer[] }} obj - Object containing buffers (either `buffers` or `bufs` property)
   * @returns {this} Returns the instance for chaining
   */
  set(obj) {
    this.buffers = obj.buffers || obj.bufs || this.buffers || [];
    this.length = this.buffers.reduce(function (prev, buf) {
      return prev + buf.length;
    }, 0);
    return this;
  }

  /**
   * Returns the buffer by concatenating all written data.
   * @returns {Buffer} The concatenated buffer.
   */
  concat() {
    return this.toBuffer();
  }

  /**
   * Converts the internal buffer chunks into a single Buffer.
   * If there's only one chunk, returns it directly. Otherwise,
   * concatenates all chunks into a new Buffer.
   * @returns {Buffer} The combined buffer
   */
  toBuffer() {
    if (this.buffers.length === 1) {
      return Buffer.from(this.buffers[0]);
    }

    const whole = new Uint8Array(this.length);

    let offset = 0;
    this.buffers.forEach((part) => {
      whole.set(part, offset);
      offset += part.length;
    });

    return Buffer.from(whole);
  }

  /**
   * Writes a buffer in reverse order to the current buffer.
   * @param {Buffer} buf - The buffer to be written in reverse.
   * @returns {this} Returns the instance for chaining.
   */
  writeReverse(buf) {
    assert(Buffer.isBuffer(buf));
    this.write(Buffer.from(buf).reverse());
    return this;
  }

  /**
   * Writes a 16-bit unsigned integer in little-endian format.
   * @param {number} n - The number to write.
   * @returns {this} Returns the instance for chaining.
   */
  writeUInt16LE(n) {
    writeU16LE(this, n);
    return this;
  }

  /**
   * Writes a 16-bit unsigned integer in big-endian byte order.
   * Internally converts the value to little-endian and reverses the bytes.
   * @param {number} n - The number to write (0-65535).
   * @returns {BufferWriter} Returns the BufferWriter instance for chaining.
   */
  writeUInt16BE(n) {
    var bw = new BufferWriter();
    bw.writeUInt16LE(n);
    this.writeReverse(bw.toBuffer());
    return this;
  }

  /**
   * Writes a 32-bit unsigned integer in little-endian format.
   * @param {number} n - The number to write.
   * @returns {this} Returns the instance for chaining.
   */
  writeUInt32LE(n) {
    writeU32LE(this, n);
    return this;
  }

  /**
   * Writes a 32-bit unsigned integer in big-endian format.
   * @param {number} n - The number to write.
   * @returns {BufferWriter} Returns the BufferWriter instance for chaining.
   */
  writeUInt32BE(n) {
    var bw = new BufferWriter();
    bw.writeUInt32LE(n);
    this.writeReverse(bw.toBuffer());
    return this;
  }

  /**
   * Writes an unsigned 8-bit integer to the buffer in little-endian format.
   * @param {number} n - The number to write (0-255)
   * @returns {this} Returns the BufferWriter instance for chaining
   */
  writeUInt8(n) {
    writeU8LE(this, n);
    return this;
  }

  /**
   * Writes a 64-bit unsigned integer in little-endian byte order from a BigNumber.
   * @param {BN} bn - The BigNumber to write.
   * @returns {this} Returns the BufferWriter instance for chaining.
   */
  writeUInt64LEBN(bn) {
    var buf = bn.toBuffer({ size: 8 });
    this.writeReverse(buf);
    return this;
  }

  /**
   * Writes a 64-bit unsigned integer in big-endian byte order (as BN.js instance).
   * Internally converts to little-endian and writes reversed for big-endian output.
   * @param {BN} bn - The BigNumber to write as 64-bit big-endian
   * @returns {BufferWriter} Returns this instance for chaining
   */
  writeUInt64BEBN(bn) {
    var bw = new BufferWriter();
    bw.writeUInt64LEBN(bn);
    this.writeReverse(bw.toBuffer());
    return this;
  }

  /**
   * Writes a variable-length integer (varint) to the buffer.
   * @param {number} n - The number to write as varint
   * @returns {this} Returns the BufferWriter instance for chaining
   */
  writeVarintNum(n) {
    writeVarint(this, n);
    return this;
  }

  /**
   * Writes a 32-bit signed integer in little-endian format to the buffer.
   * @param {number} n - The integer to write.
   * @returns {this} Returns the BufferWriter instance for chaining.
   */
  writeInt32LE(n) {
    writeI32LE(this, n);
    return this;
  }

  /**
   * Converts a number to a varint-encoded Buffer.
   * @param {number} n - The number to encode.
   * @returns {Buffer} The varint-encoded Buffer.
   */
  static varintBufNum(n) {
    var bw = new BufferWriter();
    bw.writeVarintNum(n);
    return bw.toBuffer();
  }

  /**
   * Writes a variable-length integer (varint) to the buffer using BigNumber.
   * Handles numbers of different sizes with appropriate encoding:
   * - Numbers < 253: 1 byte
   * - Numbers < 0x10000: 1 byte prefix (253) + 2 bytes
   * - Numbers < 0x100000000: 1 byte prefix (254) + 4 bytes
   * - Larger numbers: 1 byte prefix (255) + 8 bytes
   * @param {BN} bn - BigNumber to write as varint
   * @returns {BufferWriter} Returns this for chaining
   */
  writeVarintBN(bn) {
    var n = bn.toNumber();
    if (n < 253) {
      writeU8LE(this, n);
    } else if (n < 0x10000) {
      writeU8LE(this, 253);
      writeU16LE(this, n);
    } else if (n < 0x100000000) {
      writeU8LE(this, 254);
      writeU32LE(this, n);
    } else {
      var bw = new BufferWriter();
      bw.writeUInt8(255);
      bw.writeUInt64LEBN(bn);
      var buf = bw.toBuffer();
      this.write(buf);
    }
    return this;
  }
}

export default BufferWriter;
