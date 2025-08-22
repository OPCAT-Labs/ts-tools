'use strict';

var _ = require('../../util/_.cjs');
var inherits = require('inherits');
var Input = require('./input.cjs');
var Output = require('../output.cjs');
var $ = require('../../util/preconditions.cjs');

var Script = require('../../script/index.cjs');
var Signature = require('../../crypto/signature.cjs');
var Sighash = require('../sighash.cjs');
var TransactionSignature = require('../signature.cjs');
var PublicKey = require('../../publickey.cjs');
var PrivateKey = require('../../privatekey.cjs');
var Varint = require('../../encoding/varint.cjs');


/**
 * Represents a MultiSigInput for a transaction.
 * @constructor
 * @param {{prevTxId: string|Buffer, outputIndex: number, output?: Output, sequenceNumber?: number, script?: Script|Buffer|string, publicKeys?: Array.<Buffer>, threshold?: number, signatures?: Array.<TransactionSignature>}} input - The input object containing publicKeys, threshold, and signatures.
 * @param {Array.<Buffer>} [pubkeys] - Array of public keys (optional, defaults to input.publicKeys).
 * @param {number} [threshold] - Required number of signatures (optional, defaults to input.threshold).
 * @param {Array.<TransactionSignature>} [signatures] - Array of signatures (optional, defaults to input.signatures).
 * @description Validates that provided public keys match the output script and initializes signatures.
 */
function MultiSigInput(input, pubkeys, threshold, signatures) {
  Input.apply(this, arguments);
  var self = this;
  pubkeys = pubkeys || input.publicKeys;
  threshold = threshold || input.threshold;
  signatures = signatures || input.signatures;
  this.publicKeys = pubkeys
    .map((k) => k.toString('hex'))
    .sort()
    .map((k) => new PublicKey(k));
  $.checkState(
    Script.buildMultisigOut(this.publicKeys, threshold).equals(this.output.script),
    "Provided public keys don't match to the provided output script",
  );
  this.publicKeyIndex = {};
  _.each(this.publicKeys, function (publicKey, index) {
    self.publicKeyIndex[publicKey.toString()] = index;
  });
  this.threshold = threshold;
  // Empty array of signatures
  this.signatures = signatures
    ? this._deserializeSignatures(signatures)
    : new Array(this.publicKeys.length);
}
inherits(MultiSigInput, Input);

/**
 * Converts the MultiSigInput instance to a plain object representation.
 * Includes threshold, publicKeys (converted to strings), and serialized signatures.
 * @returns {{threshold: number, publicKeys: Array.<string>, signatures: any, prevTxId: string, outputIndex: number, sequenceNumber: number, script: string, scriptString?: string, output?: {satoshis: number, script: string, data: string}}} The plain object representation of the MultiSigInput.
 */
MultiSigInput.prototype.toObject = function () {
  var obj = Input.prototype.toObject.apply(this);
  obj.threshold = this.threshold;
  obj.publicKeys = _.map(this.publicKeys, function (publicKey) {
    return publicKey.toString();
  });
  obj.signatures = this._serializeSignatures();
  return obj;
};

/**
 * Deserializes an array of signature strings into TransactionSignature objects.
 * @private
 * @param {Array.<string|TransactionSignature>} signatures - Array of signature strings to deserialize
 * @returns {Array.<TransactionSignature|undefined>} Array of TransactionSignature objects (undefined for null/empty signatures)
 */
MultiSigInput.prototype._deserializeSignatures = function (signatures) {
  return _.map(signatures, function (signature) {
    if (!signature) {
      return undefined;
    }
    return new TransactionSignature(signature);
  });
};

/**
 * Serializes the signatures array by converting each signature to a plain object.
 * @returns {Array.<{publicKey: string, prevTxId: string, outputIndex: number, inputIndex: number, signature: string, sigtype: number}|undefined>} An array of signature objects or undefined values.
 * @private
 */
MultiSigInput.prototype._serializeSignatures = function () {
  return _.map(this.signatures, function (signature) {
    if (!signature) {
      return undefined;
    }
    return signature.toObject();
  });
};

/**
 * Gets signatures for a MultiSigInput by signing the transaction with the provided private key.
 * Only signs for public keys that match the private key's public key.
 * 
 * @param {Object} transaction - The transaction to sign
 * @param {PrivateKey} privateKey - The private key used for signing
 * @param {number} index - The input index
 * @param {number} [sigtype=Signature.SIGHASH_ALL] - The signature type
 * @returns {TransactionSignature[]} Array of transaction signatures
 */
MultiSigInput.prototype.getSignatures = function (transaction, privateKey, index, sigtype) {
  $.checkState(this.output instanceof Output);
  sigtype = sigtype || Signature.SIGHASH_ALL;

  var self = this;
  var results = [];
  _.each(this.publicKeys, function (publicKey) {
    if (publicKey.toString() === privateKey.publicKey.toString()) {
      results.push(
        new TransactionSignature({
          publicKey: privateKey.publicKey,
          prevTxId: self.prevTxId,
          outputIndex: self.outputIndex,
          inputIndex: index,
          signature: Sighash.sign(
            transaction,
            privateKey,
            sigtype,
            index,
          ),
          sigtype: sigtype,
        }),
      );
    }
  });

  return results;
};

/**
 * Adds a signature to the MultiSigInput if valid and not already fully signed.
 * @param {Object} transaction - The transaction to validate the signature against.
 * @param {TransactionSignature} signature - The signature object containing publicKey and signature data.
 * @throws {Error} If already fully signed, no matching public key, or invalid signature.
 * @returns {MultiSigInput} Returns the instance for chaining.
 */
MultiSigInput.prototype.addSignature = function (transaction, signature) {
  $.checkState(!this.isFullySigned(), 'All needed signatures have already been added');
  $.checkArgument(
    !_.isUndefined(this.publicKeyIndex[signature.publicKey.toString()]),
    'Signature has no matching public key',
  );
  $.checkState(this.isValidSignature(transaction, signature));
  this.signatures[this.publicKeyIndex[signature.publicKey.toString()]] = signature;
  this._updateScript();
  return this;
};

/**
 * Updates the multisig input script by rebuilding it with current public keys, threshold, and signatures.
 * @returns {MultiSigInput} Returns the instance for chaining.
 */
MultiSigInput.prototype._updateScript = function () {
  this.setScript(Script.buildMultisigIn(this.publicKeys, this.threshold, this._createSignatures()));
  return this;
};

/**
 * Creates DER-encoded signatures from the input's signature data.
 * Filters out undefined signatures and converts each valid signature to a Buffer
 * containing the DER-encoded signature followed by its sigtype byte.
 * @returns {Buffer[]} Array of signature Buffers
 */
MultiSigInput.prototype._createSignatures = function () {
  return _.map(
    _.filter(this.signatures, function (signature) {
      return !_.isUndefined(signature);
    }),
    function (signature) {
      return Buffer.concat([signature.signature.toDER(), Buffer.from([signature.sigtype & 0xff])]);
    },
  );
};

/**
 * Clears all signatures from the MultiSigInput by resetting the signatures array
 * and updating the script. The signatures array length matches the publicKeys array.
 */
MultiSigInput.prototype.clearSignatures = function () {
  this.signatures = new Array(this.publicKeys.length);
  this._updateScript();
};

/**
 * Checks if the MultiSigInput is fully signed by comparing the number of signatures
 * with the required threshold.
 * @returns {boolean} True if the input has enough signatures, false otherwise.
 */
MultiSigInput.prototype.isFullySigned = function () {
  return this.countSignatures() === this.threshold;
};

/**
 * Returns the number of missing signatures required to meet the threshold.
 * @returns {number} The count of missing signatures.
 */
MultiSigInput.prototype.countMissingSignatures = function () {
  return this.threshold - this.countSignatures();
};

/**
 * Counts the number of valid signatures in the MultiSigInput.
 * @returns {number} The count of non-null/undefined signatures.
 */
MultiSigInput.prototype.countSignatures = function () {
  return _.reduce(
    this.signatures,
    function (sum, signature) {
      return sum + !!signature;
    },
    0,
  );
};

/**
 * Returns an array of public keys that haven't been signed yet in this MultiSigInput.
 * @returns {Array.<PublicKey>} Array of unsigned public keys
 */
MultiSigInput.prototype.publicKeysWithoutSignature = function () {
  var self = this;
  return _.filter(this.publicKeys, function (publicKey) {
    return !self.signatures[self.publicKeyIndex[publicKey.toString()]];
  });
};

/**
 * Verifies a signature for a MultiSigInput transaction.
 * 
 * @param {Object} transaction - The transaction to verify.
 * @param {TransactionSignature} signature - The signature to verify.bject containing signature data.
 * @returns {boolean} True if the signature is valid, false otherwise.
 */
MultiSigInput.prototype.isValidSignature = function (transaction, signature) {
// FIXME: Refactor signature so this is not necessary
  signature.signature.nhashtype = signature.sigtype;
  return Sighash.verify(
    transaction,
    signature.signature,
    signature.publicKey,
    signature.inputIndex,
    this.output.script,
    this.output.satoshisBN,
  );
};

/**
 * Normalizes signatures for a MultiSigInput by matching each public key with its corresponding signature.
 * Filters and validates signatures against the provided public keys and transaction.
 * 
 * @param {Object} transaction - The transaction to verify against.
 * @param {Input} input - The input containing prevTxId and outputIndex.
 * @param {number} inputIndex - The index of the input in the transaction.
 * @param {Array.<Buffer>} signatures - Array of signature buffers to normalize.
 * @param {Array.<PublicKey>} publicKeys - Array of public keys to match signatures against.
 * @returns {Array.<TransactionSignature|null>} Array of matched signatures or null for unmatched keys.
 */
MultiSigInput.normalizeSignatures = function (
  transaction,
  input,
  inputIndex,
  signatures,
  publicKeys,
) {
  return publicKeys.map(function (pubKey) {
    var signatureMatch = null;
    signatures = signatures.filter(function (signatureBuffer) {
      if (signatureMatch) {
        return true;
      }

      var signature = new TransactionSignature({
        signature: Signature.fromTxFormat(signatureBuffer),
        publicKey: pubKey,
        prevTxId: input.prevTxId,
        outputIndex: input.outputIndex,
        inputIndex: inputIndex,
        sigtype: Signature.SIGHASH_ALL,
      });

      signature.signature.nhashtype = signature.sigtype;
      var isMatch = Sighash.verify(
        transaction,
        signature.signature,
        signature.publicKey,
        signature.inputIndex,
      );

      if (isMatch) {
        signatureMatch = signature;
        return false;
      }

      return true;
    });

    return signatureMatch || null;
  });
};

// 32   txid
// 4    output index
// --- script ---
// ??? script size (VARINT)
// 1    OP_0
// --- signature list ---
//      1       signature size (OP_PUSHDATA)
//      <=72    signature (DER + SIGHASH type)
//
// 4    sequence number
/**
 * The byte size of a single signature in a MultiSig input.
 * @constant
 */
MultiSigInput.SIGNATURE_SIZE = 73;

/**
 * Estimates the byte size of a MultiSigInput, including the base input size,
 * script size (with threshold-based signature count), and varint overhead.
 * @returns {number} The estimated size in bytes.
 * @private
 */
MultiSigInput.prototype._estimateSize = function () {
  var scriptSize = 1 + this.threshold * MultiSigInput.SIGNATURE_SIZE;
  return Input.BASE_SIZE + Varint(scriptSize).toBuffer().length + scriptSize;
};

module.exports = MultiSigInput;
