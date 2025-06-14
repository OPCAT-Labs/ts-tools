import {
  SmartContract,
  prop,
  Addr,
  method,
  Sig,
  PubKey,
  pubKey2Addr,
  assert,
} from '@scrypt-inc/scrypt-ts-btc';

/*
 * A simple Pay to Public Key Hash (P2PKH) contract.
 */
export class P2PKH extends SmartContract {
  // Address of the recipient.
  @prop()
  readonly address: Addr;

  constructor(address: Addr) {
    super(address);
    this.address = address;
  }

  @method()
  public unlock(sig: Sig, pubKey: PubKey) {
    // Check if the passed public key belongs to the specified address.
    assert(pubKey2Addr(pubKey) == this.address, 'pubKey does not belong to address');
    // Check signature validity.
    assert(this.checkSig(sig, pubKey), 'signature check failed');
  }
}
