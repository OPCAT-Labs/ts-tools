import { method, SmartContract, assert, Sig, PubKey, ByteString, prop, toByteString } from '@opcat-labs/scrypt-ts-opcat';

/**
 * Test contract for checkDataSig functionality.
 * checkDataSig verifies a signature against an explicit message and public key.
 */
export class CheckDataSig extends SmartContract {
  @prop()
  pubKey: PubKey;

  constructor(pubKey: PubKey) {
    super(...arguments);
    this.pubKey = pubKey;
  }

  /**
   * Unlock by providing a valid signature for the given message.
   * @param sig - The signature to verify
   * @param message - The message that was signed
   */
  @method()
  public unlock(sig: Sig, message: ByteString) {
    assert(this.checkDataSig(sig, message, this.pubKey), 'checkDataSig failed');
  }

  /**
   * Unlock with a provided public key (not from contract state).
   * @param sig - The signature to verify
   * @param message - The message that was signed
   * @param pubKey - The public key to verify against
   */
  @method()
  public unlockWithPubKey(sig: Sig, message: ByteString, pubKey: PubKey) {
    assert(this.checkDataSig(sig, message, pubKey), 'checkDataSig failed');
  }

  /**
   * Verify signature for a fixed message.
   * The message is hex-encoded 'Hello, checkDataSig!'
   * @param sig - The signature to verify
   */
  @method()
  public unlockFixedMessage(sig: Sig) {
    // 'Hello, checkDataSig!' in hex: 48656c6c6f2c20636865636b4461746153696721
    const fixedMessage: ByteString = toByteString('48656c6c6f2c20636865636b4461746153696721');
    assert(this.checkDataSig(sig, fixedMessage, this.pubKey), 'checkDataSig failed');
  }
}

/**
 * Test contract combining checkDataSig with checkSig.
 * Demonstrates using both signature verification methods.
 */
export class CheckDataSigAndSig extends SmartContract {
  @prop()
  pubKey: PubKey;

  constructor(pubKey: PubKey) {
    super(...arguments);
    this.pubKey = pubKey;
  }

  /**
   * Requires both a data signature and a transaction signature.
   * @param dataSig - Signature for the message
   * @param message - The message that was signed
   * @param txSig - Signature for the transaction
   */
  @method()
  public unlockBoth(dataSig: Sig, message: ByteString, txSig: Sig) {
    // Verify data signature
    assert(this.checkDataSig(dataSig, message, this.pubKey), 'data signature failed');
    // Verify transaction signature
    assert(this.checkSig(txSig, this.pubKey), 'tx signature failed');
  }
}
