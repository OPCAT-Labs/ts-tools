'use strict';

var _ = require('../../util/_');
var $ = require('../../util/preconditions');
var errors = require('../../errors');
var BufferWriter = require('../../encoding/bufferwriter');
var JSUtil = require('../../util/js');
var Script = require('../../script');
var Sighash = require('../sighash');
var Output = require('../output');
var Signature = require('../../crypto/signature');
var TransactionSignature = require('../signature');
var Hash = require('../../crypto/hash');
var PrivateKey = require('../../privatekey');

var MAXINT = 0xffffffff; // Math.pow(2, 32) - 1;
var DEFAULT_RBF_SEQNUMBER = MAXINT - 2;
var DEFAULT_SEQNUMBER = MAXINT;
var DEFAULT_LOCKTIME_SEQNUMBER = MAXINT - 1;

var Input = function Input(params) {
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

Input.fromObject = function (obj) {
  $.checkArgument(_.isObject(obj));
  var input = new Input();
  return input._fromObject(obj);
};

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

Input.prototype.toObject = Input.prototype.toJSON = function toObject() {
  var obj = {
    prevTxId: this.prevTxId.toString('hex'),
    outputIndex: this.outputIndex,
    sequenceNumber: this.sequenceNumber,
    script: this._scriptBuffer.toString('hex'),
  };
  // add human readable form if input contains valid script
  if (this.script) {
    obj.scriptString = this.script.toString();
  }
  if (this.output) {
    obj.output = this.output.toObject();
  }
  return obj;
};

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


Input.prototype.toPrevout = function () {
  let writer = new BufferWriter()
  writer.writeReverse(this.prevTxId)
  writer.writeUInt32LE(this.outputIndex)
  return writer.toBuffer()
}


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
 * @abstract
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
 * @abstract
 */
Input.prototype.getPreimage = function (transaction, inputIndex, sigtype, isLowS) {
  $.checkState(this.output instanceof Output);
  sigtype = sigtype || Signature.SIGHASH_ALL;
  isLowS = isLowS || false;
  return isLowS
    ? Sighash.getLowSSighashPreimage(transaction, sigtype, inputIndex)
    : Sighash.sighashPreimage(transaction, sigtype, inputIndex);
};

Input.prototype.isFullySigned = function () {
  throw new errors.AbstractMethodInvoked('Input#isFullySigned');
};

Input.prototype.isFinal = function () {
  return this.sequenceNumber === Input.MAXINT;
};

Input.prototype.addSignature = function (transaction, signature) {
  const s = Script.buildPublicKeyIn(signature.signature.toDER(), signature.sigtype)
  console.log("s:", s.toHex())
  // throw new errors.AbstractMethodInvoked('Input#addSignature')
};

Input.prototype.clearSignatures = function () {
  // throw new errors.AbstractMethodInvoked('Input#clearSignatures')
};

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

Input.prototype._estimateSize = function () {
  return this.toBufferWriter(false).toBuffer().length;
};

module.exports = Input;
