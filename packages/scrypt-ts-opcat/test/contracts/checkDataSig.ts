import { SmartContract, method, prop, assert, Sig, PubKey, ByteString, toByteString } from '@opcat-labs/scrypt-ts-opcat';

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
   */
  @method()
  public unlock(sig: Sig, message: ByteString) {
    assert(this.checkDataSig(sig, message, this.pubKey), 'checkDataSig failed');
  }

  /**
   * Unlock with a provided public key.
   */
  @method()
  public unlockWithPubKey(sig: Sig, message: ByteString, pubKey: PubKey) {
    assert(this.checkDataSig(sig, message, pubKey), 'checkDataSig failed');
  }

  /**
   * Verify signature for a fixed message.
   * The message is hex-encoded 'Hello, checkDataSig!'
   */
  @method()
  public unlockFixedMessage(sig: Sig) {
    // 'Hello, checkDataSig!' in hex: 48656c6c6f2c20636865636b4461746153696721
    const fixedMessage: ByteString = toByteString('48656c6c6f2c20636865636b4461746153696721');
    assert(this.checkDataSig(sig, fixedMessage, this.pubKey), 'checkDataSig failed');
  }
}
