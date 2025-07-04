var Transaction = require('./transaction');

var Input = require('./input');
var Output = require('./output');
var UnspentOutput = require('./unspentoutput');
var Signature = require('./signature');
var Sighash = require('./sighash');

Transaction.Input = Input;
Transaction.Output = Output;
Transaction.UnspentOutput = UnspentOutput;
Transaction.Signature = Signature;
Transaction.Sighash = Sighash;

module.exports = Transaction
module.exports.Input = Input;
module.exports.Output = Output;
module.exports.UnspentOutput = UnspentOutput;
module.exports.Signature = Signature;
module.exports.Sighash = Sighash;

