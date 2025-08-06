'use strict';

var BN = require('./bn.cjs');
var _ = require('../util/_.cjs');
var $ = require('../util/preconditions.cjs');
var JSUtil = require('../util/js.cjs');

/**
 * Creates a new Signature instance from BN values or an object.
 * @constructor
 * @param {BN|{r:BN, s: BN, i: number, compressed: boolean, nhashtype: number}} r - Either a BN instance for the r value or an object containing r and s properties.
 * @param {BN} [s] - The s value (required if r is a BN instance).
 */
function Signature(r, s) {
  if (!(this instanceof Signature)) {
    return new Signature(r, s);
  }
  if (r instanceof BN) {
    this.set({
      r: r,
      s: s,
    });
  } else if (r) {
    var obj = r;
    this.set(obj);
  }
};

/**
 * Sets signature properties from an object.
 * @param {Object} obj - Object containing signature properties
 * @param {BN} [obj.r] - r value
 * @param {BN} [obj.s] - s value
 * @param {number} [obj.i] - Public key recovery parameter (0-3)
 * @param {boolean} [obj.compressed] - Whether recovered pubkey is compressed
 * @param {number} [obj.nhashtype] - Hash type
 * @returns {Signature} Returns the signature instance for chaining
 */
Signature.prototype.set = function (obj) {
  /** @type {BN}*/
  this.r = obj.r || this.r || undefined;
  /** @type {BN}*/
  this.s = obj.s || this.s || undefined;
  /** @type {number}*/
  this.i = typeof obj.i !== 'undefined' ? obj.i : this.i; // public key recovery parameter in range [0, 3]
  /** @type {boolean}*/
  this.compressed = typeof obj.compressed !== 'undefined' ? obj.compressed : this.compressed; // whether the recovered pubkey is compressed
  /** @type {number}*/
  this.nhashtype = obj.nhashtype || this.nhashtype || undefined;
  return this;
};

/**
 * Creates a Signature instance from a compact ECDSA signature buffer.
 * @param {Buffer} buf - The compact signature buffer (65 bytes).
 * @returns {Signature} The parsed signature object.
 * @throws {Error} If the input is invalid (not a Buffer, wrong length, or invalid recovery param).
 * @static
 */
Signature.fromCompact = function (buf) {
  $.checkArgument(Buffer.isBuffer(buf), 'Argument is expected to be a Buffer');

  var sig = new Signature();

  var compressed = true;
  var i = buf.slice(0, 1)[0] - 27 - 4;
  if (i < 0) {
    compressed = false;
    i = i + 4;
  }

  var b2 = buf.slice(1, 33);
  var b3 = buf.slice(33, 65);

  $.checkArgument(i === 0 || i === 1 || i === 2 || i === 3, new Error('i must be 0, 1, 2, or 3'));
  $.checkArgument(b2.length === 32, new Error('r must be 32 bytes'));
  $.checkArgument(b3.length === 32, new Error('s must be 32 bytes'));

  sig.compressed = compressed;
  sig.i = i;
  sig.r = BN.fromBuffer(b2);
  sig.s = BN.fromBuffer(b3);

  return sig;
};

/**
 * Creates a Signature instance from a DER-encoded or raw buffer.
 * @param {Buffer} buf - The input buffer containing DER-encoded or raw signature data
 * @param {boolean} [strict] - Whether to enforce strict DER parsing rules
 * @returns {Signature} A new Signature instance with parsed r and s values
 * @static
 */
Signature.fromDER = Signature.fromBuffer = function (buf, strict) {
  var obj = Signature.parseDER(buf, strict);
  var sig = new Signature();

  sig.r = obj.r;
  sig.s = obj.s;

  return sig;
};

// The format used in a tx
/**
 * Converts a transaction-format signature buffer to a Signature object.
 * @param {Buffer} buf - The signature buffer in transaction format (DER + hash type byte)
 * @returns {Signature} The parsed Signature object with nhashtype property set
 * @static
 */
Signature.fromTxFormat = function (buf) {
  var nhashtype = buf.readUInt8(buf.length - 1);
  var derbuf = buf.slice(0, buf.length - 1);
  var sig = Signature.fromDER(derbuf, false);
  sig.nhashtype = nhashtype;
  return sig;
};

/**
 * Creates a Signature instance from a hex-encoded string.
 * @param {string} str - Hex-encoded signature string
 * @returns {Signature} Signature instance parsed from DER format
 * @static
 */
Signature.fromString = function (str) {
  var buf = Buffer.from(str, 'hex');
  return Signature.fromDER(buf);
};


/**
 * Parses a DER formatted signature buffer into its components.
 * In order to mimic the non-strict DER encoding of OpenSSL, set strict = false.
 * @param {Buffer} buf - The DER formatted signature buffer to parse
 * @param {boolean} [strict=true] - Whether to perform strict length validation
 * @returns {{header: number, length: number, rheader: number, rlength: number, rneg: boolean, rbuf: Buffer, r: BN, sheader: number, slength: number, sneg: boolean, sbuf: Buffer, s: BN}} An object containing the parsed signature components:
 *   - header: The DER header byte (0x30)
 *   - length: The total length of the signature components
 *   - rheader: The R component header byte (0x02)
 *   - rlength: The length of the R component
 *   - rneg: Whether R is negative
 *   - rbuf: The R component buffer
 *   - r: The R component as a BN
 *   - sheader: The S component header byte (0x02)
 *   - slength: The length of the S component
 *   - sneg: Whether S is negative
 *   - sbuf: The S component buffer
 *   - s: The S component as a BN
 * @throws {Error} If the buffer is not valid DER format or length checks fail
 * @static
 */
Signature.parseDER = function (buf, strict) {
  $.checkArgument(Buffer.isBuffer(buf), new Error('DER formatted signature should be a buffer'));
  if (_.isUndefined(strict)) {
    strict = true;
  }

  var header = buf[0];
  $.checkArgument(header === 0x30, new Error('Header byte should be 0x30'));

  var length = buf[1];
  var buflength = buf.slice(2).length;
  $.checkArgument(
    !strict || length === buflength,
    new Error('Length byte should length of what follows'),
  );

  length = length < buflength ? length : buflength;

  var rheader = buf[2 + 0];
  $.checkArgument(rheader === 0x02, new Error('Integer byte for r should be 0x02'));

  var rlength = buf[2 + 1];
  var rbuf = buf.slice(2 + 2, 2 + 2 + rlength);
  var r = BN.fromBuffer(rbuf);
  var rneg = buf[2 + 1 + 1] === 0x00;
  $.checkArgument(rlength === rbuf.length, new Error('Length of r incorrect'));

  var sheader = buf[2 + 2 + rlength + 0];
  $.checkArgument(sheader === 0x02, new Error('Integer byte for s should be 0x02'));

  var slength = buf[2 + 2 + rlength + 1];
  var sbuf = buf.slice(2 + 2 + rlength + 2, 2 + 2 + rlength + 2 + slength);
  var s = BN.fromBuffer(sbuf);
  var sneg = buf[2 + 2 + rlength + 2 + 2] === 0x00;
  $.checkArgument(slength === sbuf.length, new Error('Length of s incorrect'));

  var sumlength = 2 + 2 + rlength + 2 + slength;
  $.checkArgument(length === sumlength - 2, new Error('Length of signature incorrect'));

  var obj = {
    header: header,
    length: length,
    rheader: rheader,
    rlength: rlength,
    rneg: rneg,
    rbuf: rbuf,
    r: r,
    sheader: sheader,
    slength: slength,
    sneg: sneg,
    sbuf: sbuf,
    s: s,
  };

  return obj;
};

/**
 * Converts the signature to a compact format.
 * @param {number} [i] - The recovery ID (0, 1, 2, or 3). Defaults to the instance's `i` value.
 * @param {boolean} [compressed] - Whether the signature is compressed. Defaults to the instance's `compressed` value.
 * @returns {Buffer} - The compact signature as a Buffer (1 byte recovery ID + 32 bytes r + 32 bytes s).
 * @throws {Error} - If `i` is not 0, 1, 2, or 3.
 */
Signature.prototype.toCompact = function (i, compressed) {
  i = typeof i === 'number' ? i : this.i;
  compressed = typeof compressed === 'boolean' ? compressed : this.compressed;

  if (!(i === 0 || i === 1 || i === 2 || i === 3)) {
    throw new Error('i must be equal to 0, 1, 2, or 3');
  }

  var val = i + 27 + 4;
  if (compressed === false) {
    val = val - 4;
  }
  var b1 = Buffer.from([val]);
  var b2 = this.r.toBuffer({
    size: 32,
  });
  var b3 = this.s.toBuffer({
    size: 32,
  });
  return Buffer.concat([b1, b2, b3]);
};

/**
 * Converts the signature to DER format.
 * Handles negative values by prepending a zero byte if necessary.
 * 
 * @returns {Buffer} The DER-encoded signature.
 */
Signature.prototype.toBuffer = Signature.prototype.toDER = function () {
  var rnbuf = this.r.toBuffer();
  var snbuf = this.s.toBuffer();

  var rneg = !!(rnbuf[0] & 0x80);
  var sneg = !!(snbuf[0] & 0x80);

  var rbuf = rneg ? Buffer.concat([Buffer.from([0x00]), rnbuf]) : rnbuf;
  var sbuf = sneg ? Buffer.concat([Buffer.from([0x00]), snbuf]) : snbuf;

  var rlength = rbuf.length;
  var slength = sbuf.length;
  var length = 2 + rlength + 2 + slength;
  var rheader = 0x02;
  var sheader = 0x02;
  var header = 0x30;

  var der = Buffer.concat([
    Buffer.from([header, length, rheader, rlength]),
    rbuf,
    Buffer.from([sheader, slength]),
    sbuf,
  ]);
  return der;
};

/**
 * Converts the signature to a hexadecimal string representation.
 * @returns {string} The DER-encoded signature in hexadecimal format.
 */
Signature.prototype.toString = function () {
  var buf = this.toDER();
  return buf.toString('hex');
};

/**
 * This function is translated from bitcoind's IsDERSignature and is used in
 * the script interpreter.  This "DER" format actually includes an extra byte,
 * the nhashtype, at the end. It is really the tx format, not DER format.
 *
 * A canonical signature exists of: [30] [total len] [02] [len R] [R] [02] [len S] [S] [hashtype]
 * Where R and S are not negative (their first byte has its highest bit not set), and not
 * excessively padded (do not start with a 0 byte, unless an otherwise negative number follows,
 * in which case a single 0 byte is necessary and even required).
 *
 * See https://bitcointalk.org/index.php?topic=8392.msg127623#msg127623
 * 
 * @param {Buffer} buf - The buffer containing the signature to verify
 * @returns {boolean} True if the signature is valid DER-encoded, false otherwise
 * @static
 */
Signature.isTxDER = function (buf) {
  if (buf.length < 9) {
    //  Non-canonical signature: too short
    return false;
  }
  if (buf.length > 73) {
    // Non-canonical signature: too long
    return false;
  }
  if (buf[0] !== 0x30) {
    //  Non-canonical signature: wrong type
    return false;
  }
  if (buf[1] !== buf.length - 3) {
    //  Non-canonical signature: wrong length marker
    return false;
  }
  var nLenR = buf[3];
  if (5 + nLenR >= buf.length) {
    //  Non-canonical signature: S length misplaced
    return false;
  }
  var nLenS = buf[5 + nLenR];
  if (nLenR + nLenS + 7 !== buf.length) {
    //  Non-canonical signature: R+S length mismatch
    return false;
  }

  var R = buf.slice(4);
  if (buf[4 - 2] !== 0x02) {
    //  Non-canonical signature: R value type mismatch
    return false;
  }
  if (nLenR === 0) {
    //  Non-canonical signature: R length is zero
    return false;
  }
  if (R[0] & 0x80) {
    //  Non-canonical signature: R value negative
    return false;
  }
  if (nLenR > 1 && R[0] === 0x00 && !(R[1] & 0x80)) {
    //  Non-canonical signature: R value excessively padded
    return false;
  }

  var S = buf.slice(6 + nLenR);
  if (buf[6 + nLenR - 2] !== 0x02) {
    //  Non-canonical signature: S value type mismatch
    return false;
  }
  if (nLenS === 0) {
    //  Non-canonical signature: S length is zero
    return false;
  }
  if (S[0] & 0x80) {
    //  Non-canonical signature: S value negative
    return false;
  }
  if (nLenS > 1 && S[0] === 0x00 && !(S[1] & 0x80)) {
    //  Non-canonical signature: S value excessively padded
    return false;
  }
  return true;
};


/**
 * Checks if the signature's S value is within the valid range (low-S).
 * See also ECDSA signature algorithm which enforces this.
 * See also BIP 62, "low S values in signatures"
 * @returns {boolean} True if S is between 1 and the upper bound (0x7F...A0), false otherwise.
 */
Signature.prototype.hasLowS = function () {
  if (
    this.s.lt(new BN(1)) ||
    this.s.gt(new BN('7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF5D576E7357A4501DDFE92F46681B20A0', 'hex'))
  ) {
    return false;
  }
  return true;
};


/**
 * Checks if the signature has a defined hashtype.
 * - Validates that nhashtype is a natural number
 * - Accepts with or without Signature.SIGHASH_ANYONECANPAY by ignoring the bit
 * - Verifies the hashtype is between SIGHASH_ALL and SIGHASH_SINGLE
 * @returns {boolean} True if the hashtype is valid, false otherwise
 */
Signature.prototype.hasDefinedHashtype = function () {
  if (!JSUtil.isNaturalNumber(this.nhashtype)) {
    return false;
  }
  // accept with or without Signature.SIGHASH_ANYONECANPAY by ignoring the bit
  var temp = this.nhashtype & 0x1f;
  if (temp < Signature.SIGHASH_ALL || temp > Signature.SIGHASH_SINGLE) {
    return false;
  }
  return true;
};

/**
 * Converts the signature to transaction format by concatenating the DER-encoded signature
 * with the hash type byte.
 * @returns {Buffer} The signature in transaction format (DER + hash type byte).
 */
Signature.prototype.toTxFormat = function () {
  var derbuf = this.toDER();
  var buf = Buffer.alloc(1);
  buf.writeUInt8(this.nhashtype, 0);
  return Buffer.concat([derbuf, buf]);
};

/**
 * Signature hash type for signing all inputs/outputs (default).
 * @constant {number}
 * @default 0x01
 */
Signature.SIGHASH_ALL = 0x01;
/**
 * Flag indicating that no outputs are signed (only inputs are signed).
 * Used in signature hashing to specify which parts of the transaction are included in the hash.
 * @constant {number}
 * @default 0x02
 */
Signature.SIGHASH_NONE = 0x02;
/**
 * Signature hash type for single input signing (0x03).
 * @constant {number}
 * @default 0x03
 */
Signature.SIGHASH_SINGLE = 0x03;
/**
 * Bit flag indicating that only the current input is signed (others can be modified).
 * Used in Bitcoin signature hashing (SIGHASH type).
 * @constant {number}
 * @default 0x80
 */
Signature.SIGHASH_ANYONECANPAY = 0x80;

/**
 * Signature hash type for signing all inputs/outputs (default).
 * @constant {number}
 * @default 0x01
 */
Signature.ALL = Signature.SIGHASH_ALL
/**
 * Flag indicating that no outputs are signed (only inputs are signed).
 * Used in signature hashing to specify which parts of the transaction are included in the hash.
 * @constant {number}
 * @default 0x02
 */
Signature.NONE = Signature.SIGHASH_NONE
/**
 * Signature hash type for single input signing (0x03).
 * @constant {number}
 * @default 0x03
 */
Signature.SINGLE = Signature.SIGHASH_SINGLE
/**
 * Bitwise flag combination for signature hash types: 
 * SIGHASH_ALL (default) with ANYONECANPAY modifier.
 * Allows anyone to add inputs to the transaction.
 * @constant {number}
 * @default 0x81
 */
Signature.ANYONECANPAY_ALL = Signature.SIGHASH_ALL | Signature.SIGHASH_ANYONECANPAY
/**
 * Bitwise flag combination for a signature that allows anyone to pay (no output locking)
 * and doesn't commit to any outputs (SIGHASH_NONE).
 * @constant {number}
 * @default 0x82
 */
Signature.ANYONECANPAY_NONE = Signature.SIGHASH_NONE | Signature.SIGHASH_ANYONECANPAY
/**
 * Bitwise flag combination for signature allowing anyone to pay (SIGHASH_ANYONECANPAY) 
 * with single output mode (SIGHASH_SINGLE).
 * @constant {number}
 * @default 0x83
 */
Signature.ANYONECANPAY_SINGLE = Signature.SIGHASH_SINGLE | Signature.SIGHASH_ANYONECANPAY

module.exports = Signature;
