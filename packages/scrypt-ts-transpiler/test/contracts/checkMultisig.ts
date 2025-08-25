import { method, SmartContract, assert, Sig, PubKey, FixedArray } from '@opcat-labs/scrypt-ts';

export class CheckMultiSig extends SmartContract {
  @method()
  public unlock(signatures: FixedArray<Sig, 3>, publickeys: FixedArray<PubKey, 3>) {
    assert(this.checkMultiSig(signatures, publickeys), 'checkMultiSig failed');
  }

  @method()
  public unlockFewerSigs(signatures: FixedArray<Sig, 2>, publickeys: FixedArray<PubKey, 3>) {
    assert(this.checkMultiSig(signatures, publickeys), 'checkMultiSig failed');
  }
}
