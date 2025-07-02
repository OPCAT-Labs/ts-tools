import {
  SmartContract,
  method,
  assert,
  FixedArray,
  PubKey,
  Ripemd160,
  Sig,
  hash160,
  prop,
} from '@opcat-labs/scrypt-ts-opcat';

export class AccumulatorMultiSig extends SmartContract {
  @prop()
  threshold: bigint;

  @prop()
  pubKeyHashes: FixedArray<Ripemd160, typeof AccumulatorMultiSig.N>;

  public static readonly N = 3;

  constructor(
    threshold: bigint,
    pubKeyHashes: FixedArray<Ripemd160, typeof AccumulatorMultiSig.N>,
  ) {
    super(threshold, pubKeyHashes);
    this.threshold = threshold;
    this.pubKeyHashes = pubKeyHashes;
  }

  @method()
  public main(
    pubKeys: FixedArray<PubKey, typeof AccumulatorMultiSig.N>,
    sigs: FixedArray<Sig, typeof AccumulatorMultiSig.N>,
    masks: FixedArray<boolean, typeof AccumulatorMultiSig.N>,
  ) {
    let total: bigint = 0n;

    for (let i = 0; i < AccumulatorMultiSig.N; i++) {
      if (masks[i]) {
        if (hash160(pubKeys[i]) == this.pubKeyHashes[i] && this.checkSig(sigs[i], pubKeys[i])) {
          total++;
        }
      }
    }
    assert(total >= this.threshold, 'the number of signatures is less than the threshold');
  }
}
