'use strict';

var opcat = {};

// module information
opcat.version = 'v' + require('./package.json').version;
opcat.versionGuard = function (version) {
  if (version !== undefined) {
    var message = `
      More than one instance of opcat found. other version: ${version}
      Please make sure to require opcat and check that submodules do
      not also include their own opcat dependency.`;
    console.warn(message);
  }
};
opcat.versionGuard(global.opcat);
global.opcat = opcat.version;

// crypto
opcat.crypto = {};
opcat.crypto.BN = require('./lib/crypto/bn.js');
opcat.crypto.ECDSA = require('./lib/crypto/ecdsa.js');
opcat.crypto.Hash = require('./lib/crypto/hash.js');
opcat.crypto.Random = require('./lib/crypto/random.js');
opcat.crypto.Point = require('./lib/crypto/point.js');
opcat.crypto.Signature = require('./lib/crypto/signature.js');

// encoding
opcat.encoding = {};
opcat.encoding.Base58 = require('./lib/encoding/base58.js');
opcat.encoding.Base58Check = require('./lib/encoding/base58check.js');
opcat.encoding.BufferReader = require('./lib/encoding/bufferreader.js');
opcat.encoding.BufferWriter = require('./lib/encoding/bufferwriter.js');
opcat.encoding.Varint = require('./lib/encoding/varint.js');

// utilities
opcat.util = {};
opcat.util.js = require('./lib/util/js.js');
opcat.util.preconditions = require('./lib/util/preconditions.js');

// errors thrown by the library
opcat.errors = require('./lib/errors/index.js');

// main bitcoin library
opcat.Address = require('./lib/address.js');
opcat.Block = require('./lib/block/index.js');
opcat.MerkleBlock = require('./lib/block/merkleblock.js');
opcat.BlockHeader = require('./lib/block/blockheader.js');
opcat.HDPrivateKey = require('./lib/hdprivatekey.js');
opcat.HDPublicKey = require('./lib/hdpublickey.js');
opcat.Networks = require('./lib/networks.js');
opcat.Opcode = require('./lib/opcode.js');
opcat.PrivateKey = require('./lib/privatekey.js');
opcat.PublicKey = require('./lib/publickey.js');
opcat.Script = require('./lib/script/index.js');
opcat.Transaction = require('./lib/transaction/index.js');
opcat.HashCache = require('./lib/hash-cache.js');

// dependencies, subject to change
opcat.deps = {};
opcat.deps.bs58 = require('bs58');
opcat.deps.Buffer = Buffer;
opcat.deps.elliptic = require('elliptic');
opcat.deps._ = require('./lib/util/_.js');

// Internal usage, exposed for testing/advanced tweaking
opcat.Transaction.sighash = require('./lib/transaction/sighash.js');

opcat.Message = require('./lib/message/message.js');
opcat.Mnemonic = require('./lib/mnemonic/mnemonic.js');

module.exports = opcat;
// export default opcat
