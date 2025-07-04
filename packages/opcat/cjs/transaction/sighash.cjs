'use strict'
var Signature = require('../crypto/signature.cjs')
var Script = require('../script/index.cjs')
var Output = require('./output.cjs')
var BufferReader = require('../encoding/bufferreader.cjs')
var BufferWriter = require('../encoding/bufferwriter.cjs')
var Hash = require('../crypto/hash.cjs')
var ECDSA = require('../crypto/ecdsa.cjs')
var $ = require('../util/preconditions.cjs')
var _ = require('../util/_.cjs')

var SIGHASH_SINGLE_BUG = Buffer.from('0000000000000000000000000000000000000000000000000000000000000001', 'hex')

var Sighash = function Sighash() {

};

/**
 * Returns a buffer with the which is hashed with sighash that needs to be signed
 * for OP_CHECKSIG.
 *
 * @name Signing.sighash
 * @param {Transaction} transaction the transaction to sign
 * @param {number} sighashType the type of the hash
 * @param {number} inputNumber the input index for the signature
 * @param {Script} subscript the script that will be signed
 * @param {satoshisBN} input's amount (for  ForkId signatures)
 *
 */
Sighash.sighashPreimage = function (transaction, sighashType, inputNumber) {
  // Check that all inputs have an output, prevent shallow transaction
  _.each(transaction.inputs, function (input) {
    $.checkState(input.output instanceof Output, 'input.output must be an instance of Output')
  })
  $.checkArgument(sighashType === Signature.SIGHASH_ALL, 'only SIGHASH_ALL is supported')
  $.checkArgument(inputNumber < transaction.inputs.length, 'inputNumber must be less than the number of inputs')

  var nVersion
  var prevouts = []
  var spentScriptHash
  var spentDataHash
  var spentAmount
  var sequence
  var spentAmounts = []
  var spentScriptHashes = []
  var spentDataHashes = []
  var sequences = []
  var outputs = []
  var inputIndex
  var nLockTime
  var sighashTypeBuf

  const getSeparatedScript = function (script) {
    const separatedScript = new Script(script)
    separatedScript.removeCodeseparators()
    return separatedScript
  }

  // all inputs
  _.each(transaction.inputs, function (input) {
    prevouts.push(input.toPrevout())
    spentAmounts.push(new BufferWriter().writeUInt64LEBN(input.output.satoshisBN).toBuffer())
    spentScriptHashes.push(Hash.sha256(getSeparatedScript(input.output.script).toBuffer()))
    spentDataHashes.push(Hash.sha256(input.output.data))
    sequences.push(new BufferWriter().writeUInt32LE(input.sequenceNumber).toBuffer())
  })

  // current input
  spentScriptHash = Hash.sha256(getSeparatedScript(transaction.inputs[inputNumber].output.script).toBuffer())
  spentDataHash = Hash.sha256(transaction.inputs[inputNumber].output.data)
  spentAmount = new BufferWriter().writeUInt64LEBN(transaction.inputs[inputNumber].output.satoshisBN).toBuffer()
  sequence = new BufferWriter().writeUInt32LE(transaction.inputs[inputNumber].sequenceNumber).toBuffer()
  inputIndex = new BufferWriter().writeUInt32LE(inputNumber).toBuffer()
  sighashTypeBuf = new BufferWriter().writeUInt32LE(sighashType).toBuffer()

  // all outputs
  _.each(transaction.outputs, function (output) {
    outputs.push(output.toBufferWriter(true).toBuffer())
  })

  // tx.version
  nVersion = new BufferWriter().writeUInt32LE(transaction.version).toBuffer()
  // tx.nLockTime
  nLockTime = new BufferWriter().writeUInt32LE(transaction.nLockTime).toBuffer()

  let bw = new BufferWriter()

  bw.write(nVersion)
  bw.write(Hash.sha256sha256(Buffer.concat([...prevouts])))
  bw.write(spentScriptHash)
  bw.write(spentDataHash)
  bw.write(spentAmount)
  bw.write(sequence)

  bw.write(Hash.sha256sha256(Buffer.concat([...spentAmounts])))
  bw.write(Hash.sha256sha256(Buffer.concat([...spentScriptHashes])))
  bw.write(Hash.sha256sha256(Buffer.concat([...spentDataHashes])))
  bw.write(Hash.sha256sha256(Buffer.concat([...sequences])))
  bw.write(Hash.sha256sha256(Buffer.concat([...outputs])))

  bw.write(inputIndex)
  bw.write(nLockTime)
  bw.write(sighashTypeBuf)

  return bw.toBuffer()
}

Sighash.getLowSSighashPreimage = function(tx, sigtype, inputIndex) {
  var i = 0;
  do {
    var preimage = Sighash.sighashPreimage(tx, sigtype, inputIndex);

    var sighash = Hash.sha256sha256(preimage);

    if (_.isPositiveNumber(sighash.readUInt8()) && _.isPositiveNumber(sighash.readUInt8(31))) {
      return preimage;
    }

    tx.nLockTime++;
  } while (i < Number.MAX_SAFE_INTEGER);
}


/**
 * Returns a buffer of length 32 bytes with the hash that needs to be signed
 * for OP_CHECKSIG.
 *
 * @name Signing.sighash
 * @param {Transaction} transaction the transaction to sign
 * @param {number} sighashType the type of the hash
 * @param {number} inputNumber the input index for the signature
 *
 */
Sighash.sighash = function (transaction, sighashType, inputNumber) {
  var preimage = Sighash.sighashPreimage(transaction, sighashType, inputNumber)
  if (preimage.compare(SIGHASH_SINGLE_BUG) === 0) return preimage
  var ret = Hash.sha256sha256(preimage)
  ret = new BufferReader(ret).readReverse()
  return ret
}
/**
 * Create a signature
 *
 * @name Signing.sign
 * @param {Transaction} transaction
 * @param {PrivateKey} privateKey
 * @param {number} sighash
 * @param {number} inputIndex
 * @return {Signature}
 */
Sighash.sign = function (transaction, privateKey, sighashType, inputIndex) {
  var hashbuf = Sighash.sighash(transaction, sighashType, inputIndex)

  var sig = ECDSA.sign(hashbuf, privateKey, 'little').set({
    nhashtype: sighashType
  })
  return sig
}

/**
 * Verify a signature
 *
 * @name Signing.verify
 * @param {Transaction} transaction
 * @param {Signature} signature
 * @param {PublicKey} publicKey
 * @param {number} inputIndex
 * @param {Script} subscript
 * @param {satoshisBN} input's amount
 * @param {flags} verification flags
 * @return {boolean}
 */
Sighash.verify = function (transaction, signature, publicKey, inputIndex) {
  $.checkArgument(!_.isUndefined(transaction))
  $.checkArgument(!_.isUndefined(signature) && !_.isUndefined(signature.nhashtype))
  var hashbuf = Sighash.sighash(transaction, signature.nhashtype, inputIndex)
  return ECDSA.verify(hashbuf, signature, publicKey, 'little')
}

/**
 * @namespace Signing
 */
module.exports = Sighash