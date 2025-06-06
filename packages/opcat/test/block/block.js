'use strict';

var opcat = require('../..');
var BN = require('../../lib/crypto/bn');
var BufferReader = opcat.encoding.BufferReader;
var BufferWriter = opcat.encoding.BufferWriter;
var BlockHeader = opcat.BlockHeader;
var Block = opcat.Block;
var chai = require('chai');
var fs = require('fs');
var should = chai.should();
var Transaction = opcat.Transaction;

// https://test-insight.bitpay.com/block/000000000b99b16390660d79fcc138d2ad0c89a0d044c4201a02bdf1f61ffa11
var dataRawBlockBuffer = fs.readFileSync('test/data/blk86756-testnet.dat');
var dataRawBlockBinary = fs.readFileSync('test/data/blk86756-testnet.dat', 'binary');
var dataJson = fs.readFileSync('test/data/blk86756-testnet.json').toString();
var data = require('../data/blk86756-testnet');
var dataBlocks = require('../data/bitcoind/blocks');
var bockHex = fs.readFileSync('test/data/block.hex').toString();

describe('Block', function () {
  var blockhex = data.blockhex;
  var blockbuf = Buffer.from(blockhex, 'hex');
  var bh = BlockHeader.fromBuffer(Buffer.from(data.blockheaderhex, 'hex'));
  var txs = [];
  JSON.parse(dataJson).transactions.forEach(function (tx) {
    txs.push(new Transaction().fromObject(tx));
  });
  var json = dataJson;

  var genesishex =
    '010000000000000000000000000000000000000000000000000000000000000000000000f0a5e03e6de20c2c4af63d0e25f7815c4559ea6c0c02dcfc5cd72a58a9533700dae5494dffff7f20020000000101000000010000000000000000000000000000000000000000000000000000000000000000ffffffff4d04ffff001d0104455468652054696d65732030332f4a616e2f32303039204368616e63656c6c6f72206f6e206272696e6b206f66207365636f6e64206261696c6f757420666f722062616e6b73ffffffff0100f2052a01000000434104678afdb0fe5548271967f1a67130b7105cd6a828e03909a67962e0ea1f61deb649f6bc3f4cef38c4f35504e51ec112de5c384df7ba0b8d578a4c702b6bf11d5fac0000000000';
  var genesisbuf = Buffer.from(genesishex, 'hex');
  var genesisidhex = '207a246c25611aaf0f2758cad7f342ded534c47b1b16abfd2beee94305e5f726';
  var blockOneHex =
    '0000002026f7e50543e9ee2bfdab161b7bc434d5de42f3d7ca58270faf1a61256c247a2079b3053ae552b1f4e6767371fba2e17e5d0809b0e0d89593615165f684b56c9f71d03f68ffff7f20010000000102000000010000000000000000000000000000000000000000000000000000000000000000ffffffff0c510101082f454233322e302fffffffff0100f2052a010000001976a914fff49bb07d131b98555c1162332307f1aff41fc488ac0000000000';
  var blockOneBuf = Buffer.from(blockOneHex, 'hex');
  var blockOneId = '7dcc05c4a8145156780a8ffb6494aada528a7d6d66e52ff29ac312f4190c1358';

  it('should make a new block', function () {
    var b = Block(blockbuf);
    b.toBuffer().toString('hex').should.equal(blockhex);
  });

  it('should not make an empty block', function () {
    (function () {
      return new Block();
    }).should.throw('Unrecognized argument for Block');
  });

  describe('#constructor', function () {
    it('should set these known values', function () {
      var b = new Block({
        header: bh,
        transactions: txs,
      });
      should.exist(b.header);
      should.exist(b.transactions);
    });

    it('should properly deserialize blocks', function () {
      dataBlocks.forEach(function (block) {
        var b = Block.fromBuffer(Buffer.from(block.data, 'hex'));
        b.transactions.length.should.equal(block.transactions);
      });
    });
  });

  describe('#fromRawBlock', function () {
    it('should instantiate from a raw block binary', function () {
      // TODO: 
      // var x = Block.fromRawBlock(dataRawBlockBinary);
      // x.header.version.should.equal(2);
      // new BN(x.header.bits).toString('hex').should.equal('1c3fffc0');
    });

    it('should instantiate from raw block buffer', function () {
      // TODO: 
      // var x = Block.fromRawBlock(dataRawBlockBuffer);
      // x.header.version.should.equal(2);
      // new BN(x.header.bits).toString('hex').should.equal('1c3fffc0');
    });
  });

  describe('#fromJSON', function () {
    it('should set these known values', function () {
      var block = Block.fromObject(JSON.parse(json));
      should.exist(block.header);
      should.exist(block.transactions);
    });

    it('should set these known values', function () {
      var block = new Block(JSON.parse(json));
      should.exist(block.header);
      should.exist(block.transactions);
    });
  });

  describe('#toJSON', function () {
    it('should recover these known values', function () {
      var block = Block.fromObject(JSON.parse(json));
      var b = block.toJSON();
      should.exist(b.header);
      should.exist(b.transactions);
    });
  });

  describe('#fromString/#toString', function () {
    it('should output/input a block hex string', function () {
      var b = Block.fromString(blockhex);
      b.toString().should.equal(blockhex);
    });
  });

  describe('#fromBuffer', function () {
    it('should make a block from this known buffer', function () {
      var block = Block.fromBuffer(blockbuf);
      block.toBuffer().toString('hex').should.equal(blockhex);
    });

    it('should instantiate from block buffer from the network', function () {
      var networkBlock = bockHex;
      var x = Block.fromBuffer(networkBlock);
      x.toBuffer().toString('hex').should.equal(networkBlock);
    });
  });

  describe('#fromBufferReader', function () {
    it('should make a block from this known buffer', function () {
      var block = Block.fromBufferReader(BufferReader(blockbuf));
      block.toBuffer().toString('hex').should.equal(blockhex);
    });
  });

  describe('#toBuffer', function () {
    it('should recover a block from this known buffer', function () {
      var block = Block.fromBuffer(blockbuf);
      block.toBuffer().toString('hex').should.equal(blockhex);
    });
  });

  describe('#toBufferWriter', function () {
    it('should recover a block from this known buffer', function () {
      var block = Block.fromBuffer(blockbuf);
      block.toBufferWriter().concat().toString('hex').should.equal(blockhex);
    });

    it("doesn't create a bufferWriter if one provided", function () {
      var writer = new BufferWriter();
      var block = Block.fromBuffer(blockbuf);
      block.toBufferWriter(writer).should.equal(writer);
    });
  });

  describe('#toObject', function () {
    it('should recover a block from genesis block buffer', function () {
      var block = Block.fromBuffer(blockOneBuf);
      block.id.should.equal(blockOneId);
      block.toObject().should.deep.equal({
        header: {
          hash: '7dcc05c4a8145156780a8ffb6494aada528a7d6d66e52ff29ac312f4190c1358',
          version: 536870912,
          prevHash: '207a246c25611aaf0f2758cad7f342ded534c47b1b16abfd2beee94305e5f726',
          merkleRoot: '9f6cb584f66551619395d8e0b009085d7ee1a2fb717376e6f4b152e53a05b379',
          time: 1749012593,
          bits: 545259519,
          nonce: 1,
        },
        transactions: [
          {
            hash: '9f6cb584f66551619395d8e0b009085d7ee1a2fb717376e6f4b152e53a05b379',
            version: 2,
            inputs: [
              {
                prevTxId: '0000000000000000000000000000000000000000000000000000000000000000',
                outputIndex: 4294967295,
                sequenceNumber: 4294967295,
                script: '510101082f454233322e302f',
              },
            ],
            outputs: [
              {
                data: '',
                satoshis: 5000000000,
                script:
                  '76a914fff49bb07d131b98555c1162332307f1aff41fc488ac',
              },
            ],
            nLockTime: 0,
          },
        ],
      });
    });

    it('roundtrips correctly', function () {
      var block = Block.fromBuffer(blockOneBuf);
      var obj = block.toObject();
      var block2 = Block.fromObject(obj);
      block2.toObject().should.deep.equal(block.toObject());
    });
  });

  describe('#_getHash', function () {
    it('should return the correct hash of the genesis block', function () {
      var block = Block.fromBuffer(genesisbuf);
      var blockhash = Buffer.from(Array.apply([], Buffer.from(genesisidhex, 'hex')).reverse());
      block._getHash().toString('hex').should.equal(blockhash.toString('hex'));
    });
  });

  describe('#id', function () {
    it('should return the correct id of the genesis block', function () {
      var block = Block.fromBuffer(genesisbuf);
      block.id.should.equal(genesisidhex);
    });
    it('"hash" should be the same as "id"', function () {
      var block = Block.fromBuffer(genesisbuf);
      block.id.should.equal(block.hash);
    });
  });

  describe('#inspect', function () {
    it('should return the correct inspect of the genesis block', function () {
      var block = Block.fromBuffer(genesisbuf);
      block.inspect().should.equal('<Block ' + genesisidhex + '>');
    });
  });

  describe('#merkleRoot', function () {
    it('should describe as valid merkle root', function () {
      // var x = Block.fromRawBlock(dataRawBlockBinary);
      // var valid = x.validMerkleRoot();
      // valid.should.equal(true);
    });

    it('should describe as invalid merkle root', function () {
      // var x = Block.fromRawBlock(dataRawBlockBinary);
      // x.transactions.push(new Transaction());
      // var valid = x.validMerkleRoot();
      // valid.should.equal(false);
    });

    it('should get a null hash merkle root', function () {
      // var x = Block.fromRawBlock(dataRawBlockBinary);
      // x.transactions = []; // empty the txs
      // var mr = x.getMerkleRoot();
      // mr.should.deep.equal(Block.Values.NULL_HASH);
    });
  });
});
