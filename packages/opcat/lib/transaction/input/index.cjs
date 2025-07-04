
var Input = require('./input.cjs');
var PublicKey = require('./publickey.cjs');
var PublicKeyHash = require('./publickeyhash.cjs');
var MultiSig = require('./multisig.cjs');

Input.PublicKey = PublicKey;
Input.PublicKeyHash = PublicKeyHash;
Input.MultiSig = MultiSig;

module.exports = Input

module.exports.PublicKey = PublicKey
module.exports.PublicKeyHash = PublicKeyHash
module.exports.MultiSig = MultiSig