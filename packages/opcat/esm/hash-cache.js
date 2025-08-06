/**
 * Hash Cache
 * ==========
 *
 * For use in sighash.
 */
'use strict';

/**
 * A class representing a cache for transaction hash buffers.
 * Provides methods for serialization/deserialization between Buffer, JSON, and hex formats.
 * 
 * @class
 * @property {Buffer} prevoutsHashBuf - Hash buffer for transaction prevouts
 * @property {Buffer} sequenceHashBuf - Hash buffer for transaction sequence
 * @property {Buffer} outputsHashBuf - Hash buffer for transaction outputs
 */
class HashCache {
  /**
   * Constructs a new hash cache instance with the provided hash buffers.
   * @param {Buffer} prevoutsHashBuf - Hash buffer for prevouts
   * @param {Buffer} sequenceHashBuf - Hash buffer for sequence
   * @param {Buffer} outputsHashBuf - Hash buffer for outputs
   */
  constructor(prevoutsHashBuf, sequenceHashBuf, outputsHashBuf) {
    this.prevoutsHashBuf = prevoutsHashBuf;
    this.sequenceHashBuf = sequenceHashBuf;
    this.outputsHashBuf = outputsHashBuf;
  }

  /**
   * Creates a HashCache instance from a buffer by parsing it as JSON.
   * @param {Buffer} buf - The input buffer containing JSON data.
   * @returns {HashCache} A new HashCache instance created from the parsed JSON.
   */
  static fromBuffer(buf) {
    return HashCache.fromJSON(JSON.parse(buf.toString()));
  }

  /**
   * Converts the object to a Buffer containing its JSON string representation.
   * @returns {Buffer} A Buffer containing the JSON string of the object.
   */
  toBuffer() {
    return Buffer.from(JSON.stringify(this.toJSON()));
  }

  /**
   * Creates a HashCache instance from a JSON object.
   * @param {Object} json - The JSON object containing hash buffers in hex format.
   * @param {string} [json.prevoutsHashBuf] - Hex string for prevouts hash buffer.
   * @param {string} [json.sequenceHashBuf] - Hex string for sequence hash buffer.
   * @param {string} [json.outputsHashBuf] - Hex string for outputs hash buffer.
   * @returns {HashCache} A new HashCache instance with converted Buffer values.
   */
  static fromJSON(json) {
    return new HashCache(
      json.prevoutsHashBuf ? Buffer.from(json.prevoutsHashBuf, 'hex') : undefined,
      json.sequenceHashBuf ? Buffer.from(json.sequenceHashBuf, 'hex') : undefined,
      json.outputsHashBuf ? Buffer.from(json.outputsHashBuf, 'hex') : undefined,
    );
  }

  /**
   * Converts the hash cache object to a JSON representation.
   * @returns {{prevoutsHashBuf?: string, sequenceHashBuf?: string, outputsHashBuf?: string}} - An object containing hex string representations of the hash buffers:
   *                   - prevoutsHashBuf: Hex string of prevouts hash buffer (if exists)
   *                   - sequenceHashBuf: Hex string of sequence hash buffer (if exists)
   *                   - outputsHashBuf: Hex string of outputs hash buffer (if exists)
   */
  toJSON() {
    return {
      prevoutsHashBuf: this.prevoutsHashBuf ? this.prevoutsHashBuf.toString('hex') : undefined,
      sequenceHashBuf: this.sequenceHashBuf ? this.sequenceHashBuf.toString('hex') : undefined,
      outputsHashBuf: this.outputsHashBuf ? this.outputsHashBuf.toString('hex') : undefined,
    };
  }

  /**
   * Converts the object's buffer representation to a hexadecimal string.
   * @returns {string} Hexadecimal string representation of the buffer.
   */
  toHex() {
    return this.toBuffer().toString('hex');
  }

  /**
   * Creates a HashCache instance from a hex string.
   * @param {string} hex - The hex string to convert to a buffer.
   * @returns {HashCache} A HashCache instance created from the hex string buffer.
   */
  static fromHex(hex) {
    const buf = Buffer.from(hex, 'hex');
    return HashCache.fromBuffer(buf);
  }
}

export default HashCache;
