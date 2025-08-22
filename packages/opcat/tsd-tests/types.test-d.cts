import { expectType } from 'tsd';
import data  from '../test/data/blk86756-testnet.json';
import merkleblocks  from '../test/data/merkleblocks.cjs';
// Test that Address module can be imported
import {Address, Network, Networks, PrivateKey, BN, PublicKey, Point, HDPrivateKey, HDPublicKey, Opcode,
    BlockHeader, Block,
    Transaction, MerkleBlock, ECDSA, Signature,
    BufferReader, BufferWriter, Script,
    Output, Input, PublicKeyInput, PublicKeyHashInput, MultiSigInput,
    Interpreter
} from '@opcat-labs/opcat';

/** Address */
const address = new Address('16VZnHwRhwrExfeHFHGjwrgEMq8VcYPs9r');

expectType<Address>(address);

expectType<Buffer>(address.hashBuffer);
expectType<Network>(address.network);
expectType<string>(address.type);

/** Networks */

const network = Networks.livenet;
expectType<Network>(Networks.livenet);
expectType<Network>(Networks.testnet);
expectType<Network>(Networks.regtest);
expectType<Network>(Networks.defaultNetwork);

/** Network */
expectType<Network>(network);
expectType<string>(network.name);
expectType<string>(network.alias);
expectType<number>(network.pubkeyhash);
expectType<number>(network.privatekey);
expectType<number>(network.scripthash);
expectType<number>(network.xpubkey);
expectType<number>(network.xprivkey);
expectType<number>(network.networkMagic);
expectType<number>(network.port);

/** PrivateKey */
const privateKey = PrivateKey.fromRandom();

expectType<PrivateKey>(privateKey);

expectType<Buffer>(privateKey.toBuffer());
expectType<string>(privateKey.toWIF());
expectType<Network>(privateKey.network);
expectType<boolean>(privateKey.compressed);
expectType<BN>(privateKey.bn);
expectType<PublicKey>(privateKey.publicKey);
expectType<PublicKey>(privateKey.toPublicKey());
expectType<Address>(privateKey.toAddress());
expectType<{bn: string, compressed: boolean, network: string}>(privateKey.toObject());

/** PublicKey */
const publicKey = privateKey.toPublicKey();
expectType<PublicKey>(publicKey);
expectType<Buffer>(publicKey.toBuffer());
expectType<string>(publicKey.toString());
expectType<string>(publicKey.toHex());
expectType<Address>(publicKey.toAddress());
expectType<boolean>(publicKey.compressed);
expectType<Point>(publicKey.point);
expectType<Network>(publicKey.network);

/** HDPrivateKey */

const hdPrivateKey = HDPrivateKey.fromRandom();

expectType<HDPrivateKey>(hdPrivateKey);

expectType<HDPublicKey>(hdPrivateKey.hdPublicKey);

expectType<PrivateKey>(hdPrivateKey.toPrivateKey());

expectType<HDPrivateKey>(hdPrivateKey.deriveChild("m/0/1/2'"));

expectType<HDPrivateKey>(hdPrivateKey.deriveChild("m/0/1/2'"));

expectType<number>(hdPrivateKey.depth);

expectType<PrivateKey>(hdPrivateKey.privateKey);

expectType<PublicKey>(hdPrivateKey.publicKey);

expectType<Network>(hdPrivateKey.network);

expectType<string>(hdPrivateKey.xprivkey);

expectType<Buffer>(hdPrivateKey.fingerPrint);

/** HDPublicKey */

const hdPublicKey = hdPrivateKey.toHDPublicKey();

expectType<HDPublicKey>(hdPublicKey);

expectType<HDPublicKey>(hdPublicKey.deriveChild(0));

expectType<number>(hdPublicKey.depth);

expectType<Network>(hdPublicKey.network);

expectType<string>(hdPublicKey.xpubkey);

expectType<Buffer>(hdPublicKey.fingerPrint);

expectType<PublicKey>(hdPublicKey.publicKey);

/** BN */

const bn = new BN(123456789);

expectType<BN>(bn);

expectType<number>(bn.toNumber());
expectType<string>(bn.toString());
expectType<Buffer>(bn.toBuffer());
expectType<BN>(bn.add(new BN(1)));
expectType<BN>(bn.sub(new BN(1)));
expectType<BN>(bn.div(new BN(1)));
expectType<BN>(bn.mul(new BN(1)));
expectType<BN>(bn.mod(new BN(1)));

/** Opcode */

const OP_0 = new Opcode(0)

expectType<Opcode>(OP_0);

expectType<Opcode>(Opcode.fromNumber(11));

/** BlockHeader */

const bh = BlockHeader.fromObject({
    version: 1,
    prevHash: Buffer.from('0000000000000000000b4d0c1f8e2c3f5a6b7c8d9e0f1a2b3c4d5e6f7g8h9', 'hex'),
    merkleRoot: Buffer.from('0000000000000000000b4d0c1f8e2c3f5a6b7c8d9e0f1a2b3c4d5e6f7g8h9', 'hex'),
    time: 1622547800,
    bits: 0x1d00ffff,
    nonce: 2083236893,
    hash: '0000000000000000000b4d0c1f8e2c3f5a6b7c8d9e0f1a2b3c4d5e6f7g8h9'
});

expectType<BlockHeader>(bh);

expectType<BlockHeader>(new BlockHeader({
    version: 1,
    prevHash: '0000000000000000000b4d0c1f8e2c3f5a6b7c8d9e0f1a2b3c4d5e6f7g8h9',
    merkleRoot: '0000000000000000000b4d0c1f8e2c3f5a6b7c8d9e0f1a2b3c4d5e6f7g8h9',
    time: 1622547800,
    bits: 0x1d00ffff,
    nonce: 2083236893,
    hash: '0000000000000000000b4d0c1f8e2c3f5a6b7c8d9e0f1a2b3c4d5e6f7g8h9'
}));

expectType<number>(bh.bits);
expectType<number>(bh.version);
expectType<Buffer>(bh.prevHash);
expectType<Buffer>(bh.merkleRoot);
expectType<number>(bh.time);
expectType<number>(bh.nonce);
expectType<any>(bh.hash);
expectType<any>(bh.id);
expectType<string>(bh.toString());
expectType<string>(bh.inspect());


/** Block */

const block = new Block(data);
expectType<Block>(block);

expectType<Array<Transaction>>(block.transactions);
expectType<BlockHeader>(block.header);

expectType<Array<Buffer>>(block.getTransactionHashes());
expectType<Array<Buffer>>(block.getMerkleTree());
expectType<Buffer>(block.getMerkleRoot());
expectType<any>(block.hash);
expectType<any>(block.id);

/** MerkleBlock */

const blockhex = merkleblocks.HEX[0];
const blockbuf = Buffer.from(blockhex, 'hex');

const merkleBlock = new MerkleBlock(blockbuf);

expectType<MerkleBlock>(merkleBlock);

expectType<boolean>(merkleBlock.hasTransaction('6bb9ebc3d94a4d3d528afec8d79f13c5179248cc474d13a3d6f9d279afce0fd8'));

expectType<Array<string>>(merkleBlock.filteredTxsHash());

expectType<BlockHeader>(merkleBlock.header);

expectType<number>(merkleBlock.numTransactions);
expectType<string[]>(merkleBlock.hashes);
expectType<number>(merkleBlock.flags);


/** ECDSA */

const ecdsa = new ECDSA();

expectType<ECDSA>(ecdsa);

expectType<Buffer | undefined>(ecdsa.hashbuf);
expectType<"big" | "little" | undefined>(ecdsa.endian);
expectType<PrivateKey | undefined>(ecdsa.privkey);
expectType<PublicKey | undefined>(ecdsa.pubkey);
expectType<Signature | undefined>(ecdsa.sig);
expectType<BN | undefined>(ecdsa.k);
expectType<boolean | undefined>(ecdsa.verified);


/** Signature */
const signature = new Signature(new BN(123456789), new BN(987654321));

expectType<Signature>(signature);
expectType<BN>(signature.r);
expectType<BN>(signature.s);
expectType<number>(signature.nhashtype);
expectType<boolean>(signature.compressed);

/** Point */
const point = new Point(new BN(1), new BN(2));
expectType<Point>(point);
expectType<BN>(point.getX());
expectType<BN>(point.getY());
expectType<Buffer>(point.toBuffer());
expectType<string>(point.toHex());
expectType<Point>(Point.getG());
expectType<BN>(Point.getN());

/** BufferReader  */

const br = new BufferReader(Buffer.from('0000000000000000000b4d0c1f8e2c3f5a6b7c8d9e0f1a2b3c4d5e6f7g8h9', 'hex'));
expectType<BufferReader>(br);
expectType<Buffer>(br.read(32));
expectType<Buffer>(br.readAll());
expectType<number>(br.readUInt8());
expectType<number>(br.readUInt16BE());
expectType<number>(br.readUInt16LE());
expectType<number>(br.readUInt32BE());
expectType<number>(br.readUInt32LE());
expectType<number>(br.readInt32LE());
expectType<BN>(br.readUInt64BEBN());
expectType<BN>(br.readUInt64LEBN());
expectType<number>(br.readVarintNum());
expectType<BN>(br.readVarintBN());
expectType<Buffer>(br.buf);
expectType<number>(br.pos);

/** BufferWriter  */
const bw = new BufferWriter();
expectType<BufferWriter>(bw);
expectType<Buffer[]>(bw.buffers);
expectType<number>(bw.length);
expectType<Buffer>(bw.toBuffer());
expectType<BufferWriter>(bw.writeUInt32BE(123));
expectType<BufferWriter>(bw.writeUInt32LE(123));
expectType<BufferWriter>(bw.writeUInt16BE(123));
expectType<BufferWriter>(bw.writeUInt16LE(123));
expectType<BufferWriter>(bw.writeReverse(Buffer.from([1,2,3])));
expectType<BufferWriter>(bw.writeUInt64BEBN(new BN(1)));

/** Script */

const script = new Script();
expectType<Script>(script);
expectType<Script>(Script.fromBuffer(Buffer.from([0x00, 0x51])));
expectType<Script>(Script.fromHex('0051'));
expectType<Script>(Script.fromString('OP_0 OP_1'));
expectType<Buffer>(script.toBuffer());
expectType<string>(script.toHex());
expectType<string>(script.toString());
expectType<number>(script.length);
expectType<boolean>(script.isPushOnly());
expectType<boolean>(script.isPublicKeyHashOut());
expectType<boolean>(script.isPublicKeyHashIn());
expectType<boolean>(script.isDataOut());
expectType<boolean>(script.isSafeDataOut());
expectType<boolean>(script.isMultisigIn());
expectType<boolean>(script.isMultisigOut());
expectType<boolean>(script.isPushOnly());
expectType<Buffer>(script.getPublicKey());
expectType<Buffer>(script.getPublicKeyHash());
expectType<Script>(script.add(Buffer.from([0x01, 0x02, 0x03])));
expectType<Script>(script.add(Opcode.fromString('OP_1')));
expectType<Script>(script.removeCodeseparators());
expectType<boolean>(script.equals(script));
expectType<string>(script.inspect());
expectType<Address>(script.toAddress());
expectType<Address>(script.toAddress('livenet'));
expectType<Address>(script.toAddress(Networks.livenet));
/** Output */

const output = new Output({
    script: script,
    satoshis: 1000,
    data: Buffer.from('hello world'),
});

expectType<Output>(output);

expectType<number>(output.satoshis);
expectType<Script>(output.script);
expectType<Buffer | undefined>(output.data);
expectType<BufferWriter>(output.toBufferWriter(false));
expectType<number>(output.getSize());
expectType<{satoshis: number, script: string, data: string}>(output.toObject());

/** input */

const input = new Input({
    prevTxId: '0000000000000000000000000000000000000000000000000000000000000000',
    outputIndex: 0
});
expectType<Input>(input);
expectType<Output>(input.output);
expectType<BufferWriter>(input.toBufferWriter(false));
expectType<Buffer>(input.toPrevout());
expectType<Script>(input.script);
expectType<Buffer>(input.prevTxId);
expectType<number>(input.outputIndex);
expectType<number>(input.sequenceNumber);
expectType<{prevTxId: string, outputIndex: number, sequenceNumber: number, script: string, scriptString?: string, output?: {satoshis: number, script: string, data: string}}>(input.toObject());

/** PublicKeyInput */

const publicKeyInput = new PublicKeyInput({
    prevTxId: '0000000000000000000000000000000000000000000000000000000000000000',
    outputIndex: 0
});


expectType<PublicKeyInput>(publicKeyInput);

/** PublicKeyHashInput */

const publicKeyHashInput = new PublicKeyHashInput({
    prevTxId: '0000000000000000000000000000000000000000000000000000000000000000',
    outputIndex: 0
});

expectType<PublicKeyHashInput>(publicKeyHashInput);


/** MultiSigInput */

const multiSigInput = new MultiSigInput({
    prevTxId: '0000000000000000000000000000000000000000000000000000000000000000',
    outputIndex: 0,
});

expectType<MultiSigInput>(multiSigInput);

/** Transaction */
const tx1hex =
  '01000000015884e5db9de218238671572340b207ee85b628074e7e467096c267266baf77a4000000006a473044022013fa3089327b50263029265572ae1b022a91d10ac80eb4f32f291c914533670b02200d8a5ed5f62634a7e1a0dc9188a3cc460a986267ae4d58faf50c79105431327501210223078d2942df62c45621d209fab84ea9a7a23346201b7727b9b45a29c4e76f5effffffff0150690f00000000001976a9147821c0a3768aa9d1a37e16cf76002aef5373f1a888ac0000000000';

const tx = new Transaction(tx1hex);

expectType<Transaction>(tx);
expectType<Array<Input>>(tx.inputs);
expectType<Array<Output>>(tx.outputs);
expectType<number>(tx.nLockTime);
expectType<number>(tx.version);
expectType<Address>(tx.getChangeAddress());
expectType<number>(tx.getChangeAmount());
expectType<number>(tx.getEstimateFee());
expectType<number>(tx.getEstimateSize());
expectType<number>(tx.getInputAmount(1));
expectType<number>(tx.getOutputAmount(1));
expectType<number>(tx.getUnspentValue());
expectType<number>(tx.getFee());
expectType<number|Date>(tx.getLockTime());
expectType<Buffer>(tx.getPreimage(1));
expectType<Buffer>(tx.getPreimage(1, 1, true));
expectType<string[]>(tx.getSignature(1, PrivateKey.fromRandom(), 1));
expectType<Transaction>(tx.addInputFromPrevTx(tx, 1));
expectType<Transaction>(tx.addInput(input));
expectType<Transaction>(tx.addOutput(output));
expectType<Transaction>(tx.clone());
expectType<string>(tx.serialize());
expectType<Buffer>(tx.toBuffer());
expectType<Transaction>(tx.sign(PrivateKey.fromRandom()));
expectType<Transaction>(tx.sign([PrivateKey.fromRandom(), PrivateKey.fromRandom()]));




/** Interpreter */

const interp = new Interpreter();

expectType<Interpreter>(interp);
expectType<number>(interp.pc);
expectType<string>(interp.errstr);
expectType<boolean>(interp.verify(Script.empty(), Script.empty(), tx, 1, 0, 1));
expectType<boolean>(Interpreter.castToBool(Buffer.from([0x01])));











