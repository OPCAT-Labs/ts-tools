'use strict';

import BN from './bn.js';
import Point from './point.js';
import Signature from './signature.js';
import PublicKey from '../publickey.js';
import Random from './random.js';
import Hash from './hash.js';
import _ from '../util/_.js';
import $ from '../util/preconditions.js';

/**
 * Creates an ECDSA instance.
 * @constructor
 * @param {Object} [obj] - Optional object containing properties to initialize the instance.
 * @param {Buffer} [obj.hashbuf] - Hash buffer
 * @param {string} [obj.endian] - Endianness of hashbuf
 * @param {PrivateKey} [obj.privkey] - Private key
 * @param {PublicKey} [obj.pubkey] - Public key (derived from privkey if not provided)
 * @param {Signature} [obj.sig] - Signature
 * @param {BN} [obj.k] - Random number k
 * @param {boolean} [obj.verified] - Verification status
 */
function ECDSA(obj) {
  if (!(this instanceof ECDSA)) {
    return new ECDSA(obj);
  }
  if (obj) {
    this.set(obj);
  }
}

/**
 * Updates the ECDSA instance properties with provided values.
 * @param {Object} obj - Object containing properties to update
 * @param {Buffer} [obj.hashbuf] - Hash buffer
 * @param {string} [obj.endian] - Endianness of hashbuf
 * @param {PrivateKey} [obj.privkey] - Private key
 * @param {PublicKey} [obj.pubkey] - Public key (derived from privkey if not provided)
 * @param {Signature} [obj.sig] - Signature
 * @param {BN} [obj.k] - Random number k
 * @param {boolean} [obj.verified] - Verification status
 * @returns {ECDSA} Returns the updated ECDSA instance
 */
ECDSA.prototype.set = function (obj) {
  /** @type {Buffer} */
  this.hashbuf = obj.hashbuf || this.hashbuf;
  /** @type {'little' | 'big'} */
  this.endian = obj.endian || this.endian; // the endianness of hashbuf
  /** @type {PrivateKey} */
  this.privkey = obj.privkey || this.privkey;
  /** @type {PublicKey} */
  this.pubkey = obj.pubkey || (this.privkey ? this.privkey.publicKey : this.pubkey);
  /** @type {Signature} */
  this.sig = obj.sig || this.sig;
  /** @type {BN} */
  this.k = obj.k || this.k;
  /** @type {boolean} */
  this.verified = obj.verified || this.verified;
  return this;
};

/**
 * Converts the private key to a public key and stores it in the `pubkey` property.
 */
ECDSA.prototype.privkey2pubkey = function () {
  this.pubkey = this.privkey.toPublicKey();
};

/**
 * Calculates the recovery factor (i) for ECDSA signature verification.
 * Iterates through possible recovery factors (0-3) to find the one that
 * reconstructs the correct public key from the signature.
 * 
 * @returns {ECDSA} Returns the instance with updated signature properties if successful.
 * @throws {Error} Throws if no valid recovery factor is found after all iterations.
 */
ECDSA.prototype.calci = function () {
  for (var i = 0; i < 4; i++) {
    this.sig.i = i;
    var Qprime;
    try {
      Qprime = this.toPublicKey();
    } catch (e) {
      console.error(e);
      continue;
    }

    if (Qprime.point.eq(this.pubkey.point)) {
      this.sig.compressed = this.pubkey.compressed;
      return this;
    }
  }

  this.sig.i = undefined;
  throw new Error('Unable to find valid recovery factor');
};

/**
 * Creates an ECDSA instance from a JSON string representation.
 * @param {string} str - JSON string containing ECDSA parameters.
 * @returns {ECDSA} New ECDSA instance initialized with parsed data.
 */
ECDSA.fromString = function (str) {
  var obj = JSON.parse(str);
  return new ECDSA(obj);
};

/**
 * Generates a random value `k` for ECDSA signing.
 * The value is generated within the range (0, N) where N is the curve order.
 * The generated `k` is stored in the instance and returned for chaining.
 */
ECDSA.prototype.randomK = function () {
  var N = Point.getN();
  var k;
  do {
    k = BN.fromBuffer(Random.getRandomBuffer(32));
  } while (!(k.lt(N) && k.gt(BN.Zero)));
  this.k = k;
  return this;
};


/**
 * Generates a deterministic K value for ECDSA signing as per RFC 6979.
 * See:
 *  https://tools.ietf.org/html/rfc6979#section-3.2
 * Handles invalid r/s cases by incrementing badrs counter and regenerating K.
 * @param {number} [badrs=0] - Counter for invalid r/s cases (default: 0)
 * @returns {ECDSA} Returns the ECDSA instance for chaining
 */
ECDSA.prototype.deterministicK = function (badrs) {
  // if r or s were invalid when this function was used in signing,
  // we do not want to actually compute r, s here for efficiency, so,
  // we can increment badrs. explained at end of RFC 6979 section 3.2
  if (_.isUndefined(badrs)) {
    badrs = 0;
  }
  var v = Buffer.alloc(32);
  v.fill(0x01);
  var k = Buffer.alloc(32);
  k.fill(0x00);
  var x = this.privkey.bn.toBuffer({
    size: 32,
  });
  var hashbuf = this.endian === 'little' ? Buffer.from(this.hashbuf).reverse() : this.hashbuf;
  k = Hash.sha256hmac(Buffer.concat([v, Buffer.from([0x00]), x, hashbuf]), k);
  v = Hash.sha256hmac(v, k);
  k = Hash.sha256hmac(Buffer.concat([v, Buffer.from([0x01]), x, hashbuf]), k);
  v = Hash.sha256hmac(v, k);
  v = Hash.sha256hmac(v, k);
  var T = BN.fromBuffer(v);
  var N = Point.getN();

  // also explained in 3.2, we must ensure T is in the proper range (0, N)
  for (var i = 0; i < badrs || !(T.lt(N) && T.gt(BN.Zero)); i++) {
    k = Hash.sha256hmac(Buffer.concat([v, Buffer.from([0x00])]), k);
    v = Hash.sha256hmac(v, k);
    v = Hash.sha256hmac(v, k);
    T = BN.fromBuffer(v);
  }

  this.k = T;
  return this;
};

/**
 * Converts an ECDSA signature to its corresponding public key.
 * 
 * The method follows the ECDSA public key recovery process:
 * 1. Validates the recovery parameter `i` (must be 0-3)
 * 2. Derives the public key point Q using the formula: Q = r⁻¹(sR - eG)
 * 3. Validates the derived curve point
 * 
 * see:
 *  https://bitcointalk.org/index.php?topic=6430.0
 *  http://stackoverflow.com/questions/19665491/how-do-i-get-an-ecdsa-public-key-from-just-a-bitcoin-signature-sec1-4-1-6-k
 * @returns {PublicKey} The recovered public key
 * @throws {Error} If recovery parameter is invalid or derived point is invalid
 */
ECDSA.prototype.toPublicKey = function () {
  var i = this.sig.i;
  $.checkArgument(
    i === 0 || i === 1 || i === 2 || i === 3,
    new Error('i must be equal to 0, 1, 2, or 3'),
  );

  var e = BN.fromBuffer(this.hashbuf);
  var r = this.sig.r;
  var s = this.sig.s;

  // A set LSB signifies that the y-coordinate is odd
  var isYOdd = i & 1;

  // The more significant bit specifies whether we should use the
  // first or second candidate key.
  var isSecondKey = i >> 1;

  var n = Point.getN();
  var G = Point.getG();

  // 1.1 Let x = r + jn
  var x = isSecondKey ? r.add(n) : r;
  var R = Point.fromX(isYOdd, x);

  // 1.4 Check that nR is at infinity
  var nR = R.mul(n);

  if (!nR.isInfinity()) {
    throw new Error('nR is not a valid curve point');
  }

  // Compute -e from e
  var eNeg = e.neg().umod(n);

  // 1.6.1 Compute Q = r^-1 (sR - eG)
  // Q = r^-1 (sR + -eG)
  var rInv = r.invm(n);

  // var Q = R.multiplyTwo(s, G, eNeg).mul(rInv);
  var Q = R.mul(s).add(G.mul(eNeg)).mul(rInv);

  var pubkey = PublicKey.fromPoint(Q, this.sig.compressed);

  return pubkey;
};

/**
 * Validates an ECDSA signature and returns an error message if invalid.
 * Checks:
 * - hashbuf is a 32-byte buffer
 * - r and s values are within valid range
 * - Signature verification against public key
 * @returns {string|boolean} Error message if invalid, false if valid
 */
ECDSA.prototype.sigError = function () {
  if (!Buffer.isBuffer(this.hashbuf) || this.hashbuf.length !== 32) {
    return 'hashbuf must be a 32 byte buffer';
  }

  var r = this.sig.r;
  var s = this.sig.s;
  if (!(r.gt(BN.Zero) && r.lt(Point.getN())) || !(s.gt(BN.Zero) && s.lt(Point.getN()))) {
    return 'r and s not in range';
  }

  var e = BN.fromBuffer(
    this.hashbuf,
    this.endian
      ? {
          endian: this.endian,
        }
      : undefined,
  );
  var n = Point.getN();
  var sinv = s.invm(n);
  var u1 = sinv.mul(e).umod(n);
  var u2 = sinv.mul(r).umod(n);

  var p = Point.getG().mulAdd(u1, this.pubkey.point, u2);
  if (p.isInfinity()) {
    return 'p is infinity';
  }

  if (p.getX().umod(n).cmp(r) !== 0) {
    return 'Invalid signature';
  } else {
    return false;
  }
};

/**
 * Converts the signature `s` value to its low-S form to comply with BIP 62.
 * This prevents signature malleability by ensuring `s` is not greater than half the curve order.
 * @param {BN} s - The signature `s` value as a big number.
 * @returns {BN} The low-S normalized value.
 * @static
 */
ECDSA.toLowS = function (s) {
  // enforce low s
  // see BIP 62, "low S values in signatures"
  if (
    s.gt(
      BN.fromBuffer(
        Buffer.from('7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF5D576E7357A4501DDFE92F46681B20A0', 'hex'),
      ),
    )
  ) {
    s = Point.getN().sub(s);
  }
  return s;
};

/**
 * Finds a valid ECDSA signature (r, s) for the given private key `d` and message hash `e`.
 * Uses deterministic k-value generation if initial attempts fail.
 * 
 * @param {BN} d - Private key as a big number.
 * @param {BN} e - Message hash as a big number.
 * @returns {{s: BN, r: BN}} Signature object with properties `r` and `s` (big numbers).
 * @throws Will throw if unable to find valid signature after multiple attempts.
 */
ECDSA.prototype._findSignature = function (d, e) {
  var N = Point.getN();
  var G = Point.getG();
  // try different values of k until r, s are valid
  var badrs = 0;
  var k, Q, r, s;
  do {
    if (!this.k || badrs > 0) {
      this.deterministicK(badrs);
    }
    badrs++;
    k = this.k;
    Q = G.mul(k);
    r = new BN(1).mul(Q.x.umod(N));
    s = k
      .invm(N)
      .mul(e.add(d.mul(r)))
      .umod(N);
  } while (r.cmp(BN.Zero) <= 0 || s.cmp(BN.Zero) <= 0);

  s = ECDSA.toLowS(s);
  return {
    s: s,
    r: r,
  };
};

/**
 * Signs a message using ECDSA.
 * 
 * @param {Buffer} hashbuf - 32-byte buffer containing the hash of the message to sign.
 * @param {PrivateKey} privkey - Private key used for signing.
 * @returns {ECDSA} Returns the instance for chaining.
 * @throws {Error} Throws if parameters are invalid or hashbuf is not a 32-byte buffer.
 */
ECDSA.prototype.sign = function () {
  var hashbuf = this.hashbuf;
  var privkey = this.privkey;
  var d = privkey.bn;

  $.checkState(hashbuf && privkey && d, new Error('invalid parameters'));
  $.checkState(
    Buffer.isBuffer(hashbuf) && hashbuf.length === 32,
    new Error('hashbuf must be a 32 byte buffer'),
  );

  var e = BN.fromBuffer(
    hashbuf,
    this.endian
      ? {
          endian: this.endian,
        }
      : undefined,
  );

  var obj = this._findSignature(d, e);
  obj.compressed = this.pubkey.compressed;

  this.sig = new Signature(obj);
  return this;
};

/**
 * Signs the message using a randomly generated k value.
 * 
 * @returns The signature object containing r and s values.
 */
ECDSA.prototype.signRandomK = function () {
  this.randomK();
  return this.sign();
};

/**
 * Converts the ECDSA instance to a JSON string representation.
 * Includes hash buffer, private key, public key, signature, and k value if present.
 * Each property is converted to a string format (hex for hashbuf, toString() for others).
 * @returns {string} JSON string containing the ECDSA instance properties
 */
ECDSA.prototype.toString = function () {
  var obj = {};
  if (this.hashbuf) {
    obj.hashbuf = this.hashbuf.toString('hex');
  }
  if (this.privkey) {
    obj.privkey = this.privkey.toString();
  }
  if (this.pubkey) {
    obj.pubkey = this.pubkey.toString();
  }
  if (this.sig) {
    obj.sig = this.sig.toString();
  }
  if (this.k) {
    obj.k = this.k.toString();
  }
  return JSON.stringify(obj);
};

/**
 * Verifies the ECDSA signature and updates the `verified` property.
 * @returns {ECDSA} The current instance for chaining.
 */
ECDSA.prototype.verify = function () {
  if (!this.sigError()) {
    this.verified = true;
  } else {
    this.verified = false;
  }
  return this;
};

/**
 * Signs a message hash using ECDSA with the given private key.
 * @param {Buffer} hashbuf - The hash of the message to sign
 * @param {PrivateKey} privkey - The private key to sign with
 * @param {string} [endian] - Endianness of the input/output (optional)
 * @returns {Signature} The ECDSA signature
 */
ECDSA.sign = function (hashbuf, privkey, endian) {
  return ECDSA()
    .set({
      hashbuf: hashbuf,
      endian: endian,
      privkey: privkey,
    })
    .sign().sig;
};

/**
 * Signs a hash buffer with a private key and calculates the 'i' value.
 * @param {Buffer} hashbuf - The hash buffer to sign.
 * @param {Buffer} privkey - The private key used for signing.
 * @param {string} [endian] - The endianness of the input data (optional).
 * @returns {Buffer} The resulting signature.
 * @static
 */
ECDSA.signWithCalcI = function (hashbuf, privkey, endian) {
  return ECDSA()
    .set({
      hashbuf: hashbuf,
      endian: endian,
      privkey: privkey,
    })
    .sign()
    .calci().sig;
};

/**
 * Signs a message hash using ECDSA with a randomly generated K value.
 * @param {Buffer} hashbuf - The message hash to sign.
 * @param {Buffer} privkey - The private key used for signing.
 * @param {string} [endian] - The endianness of the input/output (default: 'big').
 * @returns {Buffer} The generated ECDSA signature.
 * @static
 */
ECDSA.signRandomK = function (hashbuf, privkey, endian) {
  return ECDSA()
    .set({
      hashbuf: hashbuf,
      endian: endian,
      privkey: privkey,
    })
    .signRandomK().sig;
};

/**
 * Verifies an ECDSA signature against a hash and public key.
 * @param {Buffer} hashbuf - The hash buffer to verify against.
 * @param {Signature} sig - The signature to verify.
 * @param {PublicKey} pubkey - The public key to verify with.
 * @param {string} [endian] - The endianness of the input data (optional).
 * @returns {boolean} True if the signature is valid, false otherwise.
 * @static
 */
ECDSA.verify = function (hashbuf, sig, pubkey, endian) {
  return ECDSA()
    .set({
      hashbuf: hashbuf,
      endian: endian,
      sig: sig,
      pubkey: pubkey,
    })
    .verify().verified;
};

export default ECDSA;
