var Transaction = require('./transaction.cjs');

var Input = require('./input/index.cjs');
var Output = require('./output.cjs');
var UnspentOutput = require('./unspentoutput.cjs');
var Signature = require('./signature.cjs');
var Sighash = require('./sighash.cjs');

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

