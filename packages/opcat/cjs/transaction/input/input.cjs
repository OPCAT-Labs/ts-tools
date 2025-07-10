'use strict';

var _ = require('../../util/_.cjs');
var $ = require('../../util/preconditions.cjs');
var errors = require('../../errors/index.cjs');
var BufferWriter = require('../../encoding/bufferwriter.cjs');
var JSUtil = require('../../util/js.cjs');
var Script = require('../../script/index.cjs');
var Sighash = require('../sighash.cjs');
var Output = require('../output.cjs');
var Signature = require('../../crypto/signature.cjs');
var TransactionSignature = require('../signature.cjs');
var Hash = require('../../crypto/hash.cjs');
var PrivateKey = require('../../privatekey.cjs');

var MAXINT = 0xffffffff; // Math.pow(2, 32) - 1;
var DEFAULT_RBF_SEQNUMBER = MAXINT - 2;
var DEFAULT_SEQNUMBER = MAXINT;
var DEFAULT_LOCKTIME_SEQNUMBER = MAXINT - 1;

/**
 * Creates an Input instance from parameters.
 * @constructor
 * @param {Object} params - Input parameters object
 * @param {string|Buffer} params.prevTxId - Previous transaction ID (hex string or Buffer)
 * @param {number} params.outputIndex - Output index in previous transaction
 * @param {Output} [params.output] - Output instance or output parameters
 * @param {number} [params.sequenceNumber] - Sequence number (defaults to DEFAULT_SEQNUMBER)
 * @param {Script|Buffer|string} [params.script] - Script instance, buffer or hex string
 * @returns {Input} New Input instance or initialized instance if params provided.
 */
function Input(params) {
  if (!(this instanceof Input)) {
    return new Input(params);
  }
  if (params) {
    return this._fromObject(params);
  }
}

Input.MAXINT = MAXINT;
Input.DEFAULT_SEQNUMBER = DEFAULT_SEQNUMBER;
Input.DEFAULT_LOCKTIME_SEQNUMBER = DEFAULT_LOCKTIME_SEQNUMBER;
Input.DEFAULT_RBF_SEQNUMBER = DEFAULT_RBF_SEQNUMBER;
// txid + output index + sequence number
Input.BASE_SIZE = 32 + 4 + 4;

/**
 * Gets or sets the script associated with this input.
 * @memberof Input.prototype
 * @name script
 * @return {Script}
 */
Object.defineProperty(Input.prototype, 'script', {
  configurable: false,
  enumerable: true,
  get: function () {
    if (this.isNull()) {
      return null;
    }
    if (!this._script) {
      this._script = new Script(this._scriptBuffer);
      this._script._isInput = true;
    }
    return this._script;
  },
});

/**
 * Creates an Input instance from a plain JavaScript object.
 * @param {Object} params - Input parameters object
 * @param {string|Buffer} params.prevTxId - Previous transaction ID (hex string or Buffer)
 * @param {number} params.outputIndex - Output index in previous transaction
 * @param {Output} [params.output] - Output instance or output parameters
 * @param {number} [params.sequenceNumber] - Sequence number (defaults to DEFAULT_SEQNUMBER)
 * @param {Script|Buffer|string} [params.script] - Script instance, buffer or hex string
 * @returns {Input} The created Input instance.
 * @throws {Error} Will throw if the argument is not an object.
 */
Input.fromObject = function (params) {
  $.checkArgument(_.isObject(params));
  var input = new Input();
  return input._fromObject(params);
};

/**
 * Creates an Input instance from an object containing transaction input parameters.
 * Validates required fields (prevTxId, outputIndex) and converts hex strings to Buffers.
 * Handles optional parameters with defaults (sequenceNumber, script).
 * @param {Object} params - Input parameters object
 * @param {string|Buffer} params.prevTxId - Previous transaction ID (hex string or Buffer)
 * @param {number} params.outputIndex - Output index in previous transaction
 * @param {Output} [params.output] - Output instance or output parameters
 * @param {number} [params.sequenceNumber] - Sequence number (defaults to DEFAULT_SEQNUMBER)
 * @param {Script|Buffer|string} [params.script] - Script instance, buffer or hex string
 * @throws {errors.Transaction.Input.InvalidParams} If required params are missing
 * @returns {Input} Returns the Input instance for chaining
 * @private
 */
Input.prototype._fromObject = function (params) {

  if(_.isUndefined(params.prevTxId)
    || _.isUndefined(params.outputIndex)) {
     throw new errors.Transaction.Input.InvalidParams('require prevTxId and outputIndex');
  }
  var prevTxId;
  if (_.isString(params.prevTxId) && JSUtil.isHexa(params.prevTxId)) {
    prevTxId = Buffer.from(params.prevTxId, 'hex');
  } else {
    prevTxId = params.prevTxId;
  }
  this.output = params.output
    ? params.output instanceof Output
      ? params.output
      : new Output(params.output)
    : undefined;
  this.prevTxId = prevTxId || params.txidbuf;
  this.outputIndex = _.isUndefined(params.outputIndex) ? params.txoutnum : params.outputIndex;
  this.sequenceNumber = _.isUndefined(params.sequenceNumber)
    ? _.isUndefined(params.seqnum)
      ? DEFAULT_SEQNUMBER
      : params.seqnum
    : params.sequenceNumber;
  this.setScript(params.scriptBuffer || params.script || Script.empty());
  return this;
};


/**
 * Converts the Input instance to a plain object for JSON serialization.
 * Includes prevTxId, outputIndex, sequenceNumber, and script as hex strings.
 * Optionally adds human-readable scriptString if script is valid,
 * and includes the output object if present.
 * @returns {Object} A plain object representation of the Input.
 */
Input.prototype.toObject = Input.prototype.toJSON = function toObject() {
  var obj = {
    prevTxId: this.prevTxId.toString('hex'),
    outputIndex: this.outputIndex,
    sequenceNumber: this.sequenceNumber,
    script: this._scriptBuffer.toString('hex'),
  };
  // add human readable form if input contains valid script
  if (this._script) {
    obj.scriptString = this._script.toString();
  }
  if (this.output) {
    obj.output = this.output.toObject();
  }
  return obj;
};

/**
 * Creates an Input instance from a BufferReader.
 * @param {BufferReader} br - The buffer reader containing input data.
 * @returns {Input} The parsed Input object with properties:
 *   - prevTxId: Reversed 32-byte previous transaction ID.
 *   - outputIndex: LE uint32 output index.
 *   - _scriptBuffer: Var-length script buffer.
 *   - sequenceNumber: LE uint32 sequence number.
 * @note TODO: Return specialized input types (CoinbaseInput, PublicKeyHashInput, etc.).
 * @static
 */
Input.fromBufferReader = function (br) {
  var input = new Input();
  input.prevTxId = br.readReverse(32);
  input.outputIndex = br.readUInt32LE();
  input._scriptBuffer = br.readVarLengthBuffer();
  input.sequenceNumber = br.readUInt32LE();
  // TODO: return different classes according to which input it is
  // e.g: CoinbaseInput, PublicKeyHashInput, etc.
  return input;
};

/**
 * Serializes the input to a BufferWriter.
 * @param {boolean} hashScriptSig - Whether to hash the script (true) or include it directly (false).
 * @param {BufferWriter} [writer] - Optional BufferWriter instance to write to.
 * @returns {BufferWriter} The BufferWriter containing the serialized input.
 */
Input.prototype.toBufferWriter = function (hashScriptSig, writer) {
  $.checkArgument(typeof hashScriptSig === 'boolean', 'hashScriptSig should be boolean')
  if (!writer) {
    writer = new BufferWriter()
  }
  writer.writeReverse(this.prevTxId)
  writer.writeUInt32LE(this.outputIndex)
  var script = this._scriptBuffer
  if(hashScriptSig) {
    writer.write(Hash.sha256(script))
  } else {
    writer.writeVarintNum(script.length)
    writer.write(script)
  }
  writer.writeUInt32LE(this.sequenceNumber)
  return writer
}


/**
 * Converts the input to a prevout format (txid + output index) as a buffer.
 * @returns {Buffer} The serialized prevout data.
 */
Input.prototype.toPrevout = function () {
  let writer = new BufferWriter()
  writer.writeReverse(this.prevTxId)
  writer.writeUInt32LE(this.outputIndex)
  return writer.toBuffer()
}


/**
 * Sets the script for this input.
 * @param {Script|string|Buffer|null} script - Can be a Script object, hex string, human-readable string, Buffer, or null (for empty script)
 * @returns {Input} Returns the Input instance for chaining
 * @throws {TypeError} If script is of invalid type
 */
Input.prototype.setScript = function (script) {
  this._script = null;
  if (script instanceof Script) {
    this._script = script;
    this._script._isInput = true;
    this._scriptBuffer = script.toBuffer();
  } else if (script === null) {
    this._script = Script.empty();
    this._script._isInput = true;
    this._scriptBuffer = this._script.toBuffer();
  } else if (JSUtil.isHexa(script)) {
    // hex string script
    this._scriptBuffer = Buffer.from(script, 'hex');
  } else if (_.isString(script)) {
    // human readable string script
    this._script = new Script(script);
    this._script._isInput = true;
    this._scriptBuffer = this._script.toBuffer();
  } else if (Buffer.isBuffer(script)) {
    // buffer script
    this._scriptBuffer = Buffer.from(script);
  } else {
    throw new TypeError('Invalid argument type: script');
  }
  return this;
};

/**
 * Retrieve signatures for the provided PrivateKey.
 *
 * @param {Transaction} transaction - the transaction to be signed
 * @param {PrivateKey | Array} privateKeys - the private key to use when signing
 * @param {number} inputIndex - the index of this input in the provided transaction
 * @param {number} sigType - defaults to Signature.SIGHASH_ALL
 */
Input.prototype.getSignatures = function (transaction, privateKeys, inputIndex, sigtype) {
  $.checkState(this.output instanceof Output);
  sigtype = sigtype || Signature.SIGHASH_ALL;
  var results = [];
  if (privateKeys instanceof PrivateKey) {
    results.push(
      new TransactionSignature({
        publicKey: privateKeys.publicKey,
        prevTxId: this.prevTxId,
        outputIndex: this.outputIndex,
        inputIndex: inputIndex,
        signature: Sighash.sign(
          transaction,
          privateKeys,
          sigtype,
          inputIndex,
        ),
        sigtype: sigtype,
      }),
    );
  } else if (_.isArray(privateKeys)) {
    var self = this;

    _.each(privateKeys, function (privateKey, index) {
      var sigtype_ = sigtype;
      if (_.isArray(sigtype)) {
        sigtype_ = sigtype[index] || Signature.SIGHASH_ALL;
      }
      results.push(
        new TransactionSignature({
          publicKey: privateKey.publicKey,
          prevTxId: self.prevTxId,
          outputIndex: self.outputIndex,
          inputIndex: inputIndex,
          signature: Sighash.sign(
            transaction,
            privateKey,
            sigtype_,
            inputIndex,
          ),
          sigtype: sigtype_,
        }),
      );
    });
  }
  return results;
};

/**
 * Retrieve preimage for the Input.
 *
 * @param {Transaction} transaction - the transaction to be signed
 * @param {number} inputIndex - the index of this input in the provided transaction
 * @param {number} sigType - defaults to Signature.SIGHASH_ALL
 * @param {boolean} isLowS - true if the sig hash is safe for low s.
 */
Input.prototype.getPreimage = function (transaction, inputIndex, sigtype, isLowS) {
  $.checkState(this.output instanceof Output);
  sigtype = sigtype || Signature.SIGHASH_ALL;
  isLowS = isLowS || false;
  return isLowS
    ? Sighash.getLowSSighashPreimage(transaction, sigtype, inputIndex)
    : Sighash.sighashPreimage(transaction, sigtype, inputIndex);
};

/**
 * Abstract method that throws an error when invoked. Must be implemented by subclasses
 * to determine if all required signatures are present on this input.
 * @throws {AbstractMethodInvoked} Always throws to indicate abstract method usage
 * @abstract
 */
Input.prototype.isFullySigned = function () {
  throw new errors.AbstractMethodInvoked('Input#isFullySigned');
};

/**
 * Checks if the input is final (has maximum sequence number).
 * @returns {boolean} True if the input is final, false otherwise.
 */
Input.prototype.isFinal = function () {
  return this.sequenceNumber === Input.MAXINT;
};

/**
 * Abstract method to add a signature to the transaction input.
 * Must be implemented by concrete input types.
 * @param {Object} transaction - The transaction to sign
 * @param {Object} signature - The signature to add
 * @abstract
 */
Input.prototype.addSignature = function (_transaction, _signature) {
};

/**
 * Clears all signatures from the input.
 * @abstract
 */
Input.prototype.clearSignatures = function () {

};

/**
 * Verifies if a signature is valid for this input in the given transaction.
 * Note: Temporarily modifies the signature object by setting nhashtype from sigtype.
 * 
 * @param {Object} transaction - The transaction to verify against
 * @param {TransactionSignature} signature - Signature object containing signature, publicKey, etc.
 * @returns {boolean} True if the signature is valid, false otherwise
 */
Input.prototype.isValidSignature = function (transaction, signature) {
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
 * @returns true if this is a coinbase input (represents no input)
 */
Input.prototype.isNull = function () {
  return (
    this.prevTxId.toString('hex') ===
      '0000000000000000000000000000000000000000000000000000000000000000' &&
    this.outputIndex === 0xffffffff
  );
};

/**
 * Estimates the size of the input in bytes by converting it to a buffer.
 * @returns {number} The length of the serialized buffer in bytes.
 * @private
 */
Input.prototype._estimateSize = function () {
  return this.toBufferWriter(false).toBuffer().length;
};


module.exports = Input;
