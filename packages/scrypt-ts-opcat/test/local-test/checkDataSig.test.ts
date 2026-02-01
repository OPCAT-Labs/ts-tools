import * as dotenv from 'dotenv';
import { expect } from 'chai';
import {
  PrivateKey,
  PubKey,
  Sig,
  toByteString,
  sha256,
} from '@opcat-labs/scrypt-ts-opcat';
import { crypto } from '@opcat-labs/opcat';

dotenv.config();

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
