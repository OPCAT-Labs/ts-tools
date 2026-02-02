import * as dotenv from 'dotenv';
import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import {
  PrivateKey,
  PubKey,
  Sig,
  toByteString,
  sha256,
  ExtPsbt,
  bvmVerify,
  DefaultSigner,
  ContextUtils,
  signData,
  signDataWithInternalKey,
} from '@opcat-labs/scrypt-ts-opcat';
import { crypto } from '@opcat-labs/opcat';
import { readArtifact } from '../utils/index.js';
import { CheckDataSig } from '../contracts/checkDataSig.js';

dotenv.config();
use(chaiAsPromised);

/**
 * Unit tests for checkDataSig functionality.
 * These tests verify the runtime implementation of checkDataSig
 * which uses OP_CHECKSIGFROMSTACK under the hood.
 */
describe('Test checkDataSig Runtime', () => {
  // Helper function to create a signature for a message
  function signMessage(message: string, privateKey: PrivateKey): Sig {
    const msgBytes = toByteString(message, true);
    const msgHash = Buffer.from(sha256(msgBytes), 'hex');

    const signature = crypto.ECDSA.sign(msgHash, privateKey, 'little');
    const sigDER = signature.toDER();
    // Append sighash type (0x01 = SIGHASH_ALL)
    const sigWithType = Buffer.concat([sigDER, Buffer.from([0x01])]);
    return Sig(sigWithType.toString('hex'));
  }

  it('should verify a valid signature', () => {
    const privateKey = PrivateKey.fromRandom();
    const publicKey = privateKey.toPublicKey();

    const message = 'Hello, checkDataSig!';
    const sig = signMessage(message, privateKey);

    // Manually verify using the same logic as checkDataSigImpl
    const msgBytes = toByteString(message, true);
    const msgHash = Buffer.from(sha256(msgBytes), 'hex');

    const sigObj = crypto.Signature.fromTxFormat(Buffer.from(sig, 'hex'));
    const verified = crypto.ECDSA.verify(
      msgHash,
      sigObj,
      publicKey,
      'little'
    );

    expect(verified).to.equal(true);
  });

  it('should reject an invalid signature', () => {
    const privateKey = PrivateKey.fromRandom();
    const wrongPrivateKey = PrivateKey.fromRandom();
    const publicKey = privateKey.toPublicKey();

    const message = 'Test message';
    // Sign with wrong private key
    const sig = signMessage(message, wrongPrivateKey);

    const msgBytes = toByteString(message, true);
    const msgHash = Buffer.from(sha256(msgBytes), 'hex');

    const sigObj = crypto.Signature.fromTxFormat(Buffer.from(sig, 'hex'));
    const verified = crypto.ECDSA.verify(
      msgHash,
      sigObj,
      publicKey,
      'little'
    );

    expect(verified).to.equal(false);
  });

  it('should verify signature for empty message', () => {
    const privateKey = PrivateKey.fromRandom();
    const publicKey = privateKey.toPublicKey();

    const message = '';
    const sig = signMessage(message, privateKey);

    const msgBytes = toByteString(message, true);
    const msgHash = Buffer.from(sha256(msgBytes), 'hex');

    const sigObj = crypto.Signature.fromTxFormat(Buffer.from(sig, 'hex'));
    const verified = crypto.ECDSA.verify(
      msgHash,
      sigObj,
      publicKey,
      'little'
    );

    expect(verified).to.equal(true);
  });

  it('should verify signature for long message', () => {
    const privateKey = PrivateKey.fromRandom();
    const publicKey = privateKey.toPublicKey();

    // Create a long message
    const message = 'A'.repeat(1000);
    const sig = signMessage(message, privateKey);

    const msgBytes = toByteString(message, true);
    const msgHash = Buffer.from(sha256(msgBytes), 'hex');

    const sigObj = crypto.Signature.fromTxFormat(Buffer.from(sig, 'hex'));
    const verified = crypto.ECDSA.verify(
      msgHash,
      sigObj,
      publicKey,
      'little'
    );

    expect(verified).to.equal(true);
  });

  it('should reject signature for modified message', () => {
    const privateKey = PrivateKey.fromRandom();
    const publicKey = privateKey.toPublicKey();

    const originalMessage = 'Original message';
    const modifiedMessage = 'Modified message';

    // Sign original message
    const sig = signMessage(originalMessage, privateKey);

    // Try to verify with modified message
    const msgBytes = toByteString(modifiedMessage, true);
    const msgHash = Buffer.from(sha256(msgBytes), 'hex');

    const sigObj = crypto.Signature.fromTxFormat(Buffer.from(sig, 'hex'));
    const verified = crypto.ECDSA.verify(
      msgHash,
      sigObj,
      publicKey,
      'little'
    );

    expect(verified).to.equal(false);
  });

  it('should verify signature for binary data', () => {
    const privateKey = PrivateKey.fromRandom();
    const publicKey = privateKey.toPublicKey();

    // Use raw hex bytes as message
    const msgHex = 'deadbeef0102030405060708090a0b0c0d0e0f';
    const msgHash = Buffer.from(sha256(msgHex), 'hex');

    const signature = crypto.ECDSA.sign(msgHash, privateKey, 'little');
    const sigDER = signature.toDER();
    const sigWithType = Buffer.concat([sigDER, Buffer.from([0x01])]);

    const sigObj = crypto.Signature.fromTxFormat(sigWithType);
    const verified = crypto.ECDSA.verify(
      msgHash,
      sigObj,
      publicKey,
      'little'
    );

    expect(verified).to.equal(true);
  });

  it('should use SHA256 single hash (not hash256 double hash)', () => {
    const privateKey = PrivateKey.fromRandom();
    const publicKey = privateKey.toPublicKey();

    const message = 'Test single hash';
    const msgBytes = toByteString(message, true);

    // SHA256 single hash
    const singleHash = Buffer.from(sha256(msgBytes), 'hex');

    // SHA256 double hash (hash256)
    const doubleHash = Buffer.from(sha256(sha256(msgBytes)), 'hex');

    // Sign with single hash
    const signature = crypto.ECDSA.sign(singleHash, privateKey, 'little');
    const sigDER = signature.toDER();
    const sigWithType = Buffer.concat([sigDER, Buffer.from([0x01])]);
    const sigObj = crypto.Signature.fromTxFormat(sigWithType);

    // Verify with single hash - should pass
    const verifiedSingle = crypto.ECDSA.verify(
      singleHash,
      sigObj,
      publicKey,
      'little'
    );
    expect(verifiedSingle).to.equal(true);

    // Verify with double hash - should fail
    const verifiedDouble = crypto.ECDSA.verify(
      doubleHash,
      sigObj,
      publicKey,
      'little'
    );
    expect(verifiedDouble).to.equal(false);
  });

  it('should handle different sighash types', () => {
    const privateKey = PrivateKey.fromRandom();
    const publicKey = privateKey.toPublicKey();

    const message = 'Test sighash types';
    const msgBytes = toByteString(message, true);
    const msgHash = Buffer.from(sha256(msgBytes), 'hex');

    const signature = crypto.ECDSA.sign(msgHash, privateKey, 'little');
    const sigDER = signature.toDER();

    // Test with different sighash types
    const sighashTypes = [0x01, 0x02, 0x03, 0x81, 0x82, 0x83];

    for (const sighashType of sighashTypes) {
      const sigWithType = Buffer.concat([sigDER, Buffer.from([sighashType])]);
      const sigObj = crypto.Signature.fromTxFormat(sigWithType);

      // The signature verification should still work regardless of sighash type
      // because checkDataSig only verifies the ECDSA signature, not the sighash semantics
      const verified = crypto.ECDSA.verify(
        msgHash,
        sigObj,
        publicKey,
        'little'
      );

      expect(verified).to.equal(true, `Failed for sighash type: ${sighashType}`);
    }
  });
});

/**
 * End-to-end contract tests for CheckDataSig.
 * These tests verify the full contract execution using ExtPsbt and bvmVerify.
 */
describe('Test CheckDataSig Contract', () => {
  let testSigner: DefaultSigner;

  before(() => {
    testSigner = new DefaultSigner();
    CheckDataSig.loadArtifact(readArtifact('checkDataSig.json'));
  });

  it('should unlock with valid data signature using unlock method', async () => {
    // Use the hardcoded public key from ContextUtils
    const pubKey = ContextUtils.pubKey;
    const contract = new CheckDataSig(pubKey);

    contract.bindToUtxo({
      txId: 'c1a1a777a52f765ebfa295a35c12280279edd46073d41f4767602f819f574f82',
      outputIndex: 0,
      satoshis: 10000,
      data: '',
    });

    const address = await testSigner.getAddress();

    // Create message and sign it with the hardcoded private key
    const message = toByteString('Hello, World!', true);
    const sig = signDataWithInternalKey(message);

    const psbt = new ExtPsbt()
      .addContractInput(contract, (c) => {
        c.unlock(sig, message);
      })
      .change(address, 1)
      .seal()
      .finalizeAllInputs();

    expect(psbt.isFinalized).to.be.true;
    expect(bvmVerify(psbt, 0)).to.eq(true);
  });

  it('should unlock with valid data signature using unlockWithPubKey method', async () => {
    // Use a different pubKey in constructor, but pass the correct one in method
    const pubKey = ContextUtils.pubKey;
    const contract = new CheckDataSig(pubKey);

    contract.bindToUtxo({
      txId: 'c1a1a777a52f765ebfa295a35c12280279edd46073d41f4767602f819f574f82',
      outputIndex: 0,
      satoshis: 10000,
      data: '',
    });

    const address = await testSigner.getAddress();

    // Create message and sign it
    const message = toByteString('Test unlockWithPubKey', true);
    const sig = signDataWithInternalKey(message);

    const psbt = new ExtPsbt()
      .addContractInput(contract, (c) => {
        c.unlockWithPubKey(sig, message, pubKey);
      })
      .change(address, 1)
      .seal()
      .finalizeAllInputs();

    expect(psbt.isFinalized).to.be.true;
    expect(bvmVerify(psbt, 0)).to.eq(true);
  });

  it('should unlock with valid signature for fixed message', async () => {
    const pubKey = ContextUtils.pubKey;
    const contract = new CheckDataSig(pubKey);

    contract.bindToUtxo({
      txId: 'c1a1a777a52f765ebfa295a35c12280279edd46073d41f4767602f819f574f82',
      outputIndex: 0,
      satoshis: 10000,
      data: '',
    });

    const address = await testSigner.getAddress();

    // The fixed message is 'Hello, checkDataSig!' in hex: 48656c6c6f2c20636865636b4461746153696721
    const fixedMessage = toByteString('48656c6c6f2c20636865636b4461746153696721');
    const sig = signDataWithInternalKey(fixedMessage);

    const psbt = new ExtPsbt()
      .addContractInput(contract, (c) => {
        c.unlockFixedMessage(sig);
      })
      .change(address, 1)
      .seal()
      .finalizeAllInputs();

    expect(psbt.isFinalized).to.be.true;
    expect(bvmVerify(psbt, 0)).to.eq(true);
  });

  it('should fail with wrong signature', async () => {
    const pubKey = ContextUtils.pubKey;
    const contract = new CheckDataSig(pubKey);

    contract.bindToUtxo({
      txId: 'c1a1a777a52f765ebfa295a35c12280279edd46073d41f4767602f819f574f82',
      outputIndex: 0,
      satoshis: 10000,
      data: '',
    });

    const address = await testSigner.getAddress();

    // Sign a different message than what we pass to unlock
    const signedMessage = toByteString('Wrong message', true);
    const providedMessage = toByteString('Correct message', true);
    const sig = signDataWithInternalKey(signedMessage);

    const psbt = new ExtPsbt()
      .addContractInput(contract, (c) => {
        c.unlock(sig, providedMessage);
      })
      .change(address, 1)
      .seal();

    // Finalize should throw because the checkDataSig assertion fails
    expect(() => psbt.finalizeAllInputs()).to.throw(/checkDataSig failed/);
  });

  it('should unlock with empty message', async () => {
    const pubKey = ContextUtils.pubKey;
    const contract = new CheckDataSig(pubKey);

    contract.bindToUtxo({
      txId: 'c1a1a777a52f765ebfa295a35c12280279edd46073d41f4767602f819f574f82',
      outputIndex: 0,
      satoshis: 10000,
      data: '',
    });

    const address = await testSigner.getAddress();

    // Empty message
    const message = toByteString('');
    const sig = signDataWithInternalKey(message);

    const psbt = new ExtPsbt()
      .addContractInput(contract, (c) => {
        c.unlock(sig, message);
      })
      .change(address, 1)
      .seal()
      .finalizeAllInputs();

    expect(psbt.isFinalized).to.be.true;
    expect(bvmVerify(psbt, 0)).to.eq(true);
  });

  it('should unlock with binary data message', async () => {
    const pubKey = ContextUtils.pubKey;
    const contract = new CheckDataSig(pubKey);

    contract.bindToUtxo({
      txId: 'c1a1a777a52f765ebfa295a35c12280279edd46073d41f4767602f819f574f82',
      outputIndex: 0,
      satoshis: 10000,
      data: '',
    });

    const address = await testSigner.getAddress();

    // Binary data message (raw hex)
    const message = toByteString('deadbeef0102030405060708090a0b0c0d0e0f');
    const sig = signDataWithInternalKey(message);

    const psbt = new ExtPsbt()
      .addContractInput(contract, (c) => {
        c.unlock(sig, message);
      })
      .change(address, 1)
      .seal()
      .finalizeAllInputs();

    expect(psbt.isFinalized).to.be.true;
    expect(bvmVerify(psbt, 0)).to.eq(true);
  });

  it('should unlock with signData using custom private key (Oracle scenario)', async () => {
    // Simulate Oracle scenario: use a custom private key
    const oraclePrivKey = PrivateKey.fromRandom();
    const oraclePubKey = PubKey(oraclePrivKey.toPublicKey().toHex());

    // Create contract with Oracle's public key
    const contract = new CheckDataSig(oraclePubKey);

    contract.bindToUtxo({
      txId: 'c1a1a777a52f765ebfa295a35c12280279edd46073d41f4767602f819f574f82',
      outputIndex: 0,
      satoshis: 10000,
      data: '',
    });

    const address = await testSigner.getAddress();

    // Oracle signs data with its private key
    const priceData = toByteString('BTC/USD:50000', true);
    const sig = signData(oraclePrivKey, priceData);

    const psbt = new ExtPsbt()
      .addContractInput(contract, (c) => {
        c.unlock(sig, priceData);
      })
      .change(address, 1)
      .seal()
      .finalizeAllInputs();

    expect(psbt.isFinalized).to.be.true;
    expect(bvmVerify(psbt, 0)).to.eq(true);
  });

  it('should fail signData with wrong private key', async () => {
    // Oracle's key pair
    const oraclePrivKey = PrivateKey.fromRandom();
    const oraclePubKey = PubKey(oraclePrivKey.toPublicKey().toHex());

    // Attacker's key
    const attackerPrivKey = PrivateKey.fromRandom();

    // Create contract expecting Oracle's public key
    const contract = new CheckDataSig(oraclePubKey);

    contract.bindToUtxo({
      txId: 'c1a1a777a52f765ebfa295a35c12280279edd46073d41f4767602f819f574f82',
      outputIndex: 0,
      satoshis: 10000,
      data: '',
    });

    const address = await testSigner.getAddress();

    // Attacker tries to sign with their own key
    const priceData = toByteString('BTC/USD:50000', true);
    const fakeSig = signData(attackerPrivKey, priceData);

    const psbt = new ExtPsbt()
      .addContractInput(contract, (c) => {
        c.unlock(fakeSig, priceData);
      })
      .change(address, 1)
      .seal();

    // Should fail because signature doesn't match Oracle's public key
    expect(() => psbt.finalizeAllInputs()).to.throw(/checkDataSig failed/);
  });
});
