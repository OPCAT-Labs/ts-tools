'use strict';

var should = require('chai').should();

var opcat = require('../../..');
var Transaction = opcat.Transaction;
var PrivateKey = opcat.PrivateKey;
var Script = opcat.Script;
var MultiSigInput = opcat.Transaction.Input.MultiSig;
var _ = opcat.util._;


describe('MultiSigInput', function () {
  var privateKey1 = new PrivateKey('KwF9LjRraetZuEjR8VqEq539z137LW5anYDUnVK11vM3mNMHTWb4');
  var privateKey2 = new PrivateKey('L4PqnaPTCkYhAqH3YQmefjxQP6zRcF4EJbdGqR8v6adtG9XSsadY');
  var privateKey3 = new PrivateKey('L4CTX79zFeksZTyyoFuPQAySfmP7fL3R41gWKTuepuN7hxuNuJwV');
  var public1 = privateKey1.publicKey;
  var public2 = privateKey2.publicKey;
  var public3 = privateKey3.publicKey;
  var output = {
    txId: '66e64ef8a3b384164b78453fa8c8194de9a473ba14f89485a0e433699daec140',
    outputIndex: 0,
    script: new Script(
      '5221025c95ec627038e85b5688a9b3d84d28c5ebe66e8c8d697d498e20fe96e3b1ab1d2102cdddfc974d41a62f1f80081deee70592feb7d6e6cf6739d6592edbe7946720e72103c95924e02c240b5545089c69c6432447412b58be43fd671918bd184a5009834353ae',
    ),
    satoshis: 1000000,
  };
 
  it('can parse list of signature buffers, from TX signed with key 1 and 2', function () {
    var transaction = new Transaction(
      '010000000140c1ae9d6933e4a08594f814ba73a4e94d19c8a83f45784b1684b3a3f84ee66600000000920047304402207031af27ed2b2440f11b803e0c311c257f5b69b94d1b231428d7157085d7f6c20220132dbdebaa417c2f54790bcdcc3730bd1b943fe9aa71e504b13be674111eecd301483045022100f6f1d3c135ac3ff8a81614a56142cf5aa68efde447955373980f8fc73068f3bb0220497f40851cc930a7783159fde902108ad3d936879413e448b7fcb7803930663d01ffffffff0140420f000000000017a91419438da7d16709643be5abd8df62ca4034a489a7870000000000',
    );

    var inputObj = transaction.inputs[0].toObject();
    inputObj.output = output;
    transaction.inputs[0] = new Transaction.Input(inputObj);

    inputObj.signatures = MultiSigInput.normalizeSignatures(
      transaction,
      transaction.inputs[0],
      0,
      transaction.inputs[0].script.chunks.slice(1).map(function (s) {
        return s.buf;
      }),
      [public1, public2, public3],
    );

    transaction.inputs[0] = new MultiSigInput(inputObj, [public1, public2, public3], 2);

    transaction.inputs[0].signatures[0].publicKey.should.deep.equal(public1);
    transaction.inputs[0].signatures[1].publicKey.should.deep.equal(public2);
    should.equal(transaction.inputs[0].signatures[2], undefined);
    transaction.inputs[0]
      .isValidSignature(transaction, transaction.inputs[0].signatures[0])
      .should.equal(true);
    transaction.inputs[0]
      .isValidSignature(transaction, transaction.inputs[0].signatures[1])
      .should.equal(true);
  });
  it('can parse list of signature buffers, from TX signed with key 3 and 1', function () {
    var transaction = new Transaction(
      '010000000140c1ae9d6933e4a08594f814ba73a4e94d19c8a83f45784b1684b3a3f84ee66600000000910047304402207031af27ed2b2440f11b803e0c311c257f5b69b94d1b231428d7157085d7f6c20220132dbdebaa417c2f54790bcdcc3730bd1b943fe9aa71e504b13be674111eecd301473044022059e3652eb43cb42a65f633dd6ecd1014350a164f89cb44104f926b93affbe09f02206bdf93eddf0c2fadd9ea1b9ab273f90e15a03e821fe5de87e457d1940b569dc001ffffffff0140420f000000000017a91419438da7d16709643be5abd8df62ca4034a489a7870000000000',
    );

    var inputObj = transaction.inputs[0].toObject();
    inputObj.output = output;
    transaction.inputs[0] = new Transaction.Input(inputObj);

    inputObj.signatures = MultiSigInput.normalizeSignatures(
      transaction,
      transaction.inputs[0],
      0,
      transaction.inputs[0].script.chunks.slice(1).map(function (s) {
        return s.buf;
      }),
      [public1, public2, public3],
    );

    transaction.inputs[0] = new MultiSigInput(inputObj, [public1, public2, public3], 2);

    transaction.inputs[0].signatures[0].publicKey.should.deep.equal(public1);
    should.equal(transaction.inputs[0].signatures[1], undefined);
    transaction.inputs[0].signatures[2].publicKey.should.deep.equal(public3);
    transaction.inputs[0]
      .isValidSignature(transaction, transaction.inputs[0].signatures[0])
      .should.equal(true);
    transaction.inputs[0]
      .isValidSignature(transaction, transaction.inputs[0].signatures[2])
      .should.equal(true);
  });
});
