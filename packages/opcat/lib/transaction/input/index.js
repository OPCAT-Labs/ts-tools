
var Input = require('./input.js');
var PublicKey = require('./publickey.js');
var PublicKeyHash = require('./publickeyhash.js');
var MultiSig = require('./multisig.js');

Input.PublicKey = PublicKey;
Input.PublicKeyHash = PublicKeyHash;
Input.MultiSig = MultiSig;

module.exports = Input

module.exports.PublicKey = PublicKey
module.exports.PublicKeyHash = PublicKeyHash
module.exports.MultiSig = MultiSig