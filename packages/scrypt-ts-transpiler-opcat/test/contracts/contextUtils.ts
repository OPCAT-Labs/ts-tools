import { prop, method, assert, byteStringToInt, intToByteString, len, 
  SmartContractLib, reverseByteString, slice, toByteString, hash256, PubKey, ByteString, Sig, Int32, 
  PrivKey, SHPreimage, SpentScriptHashes, SpentAmounts, Prevouts, Outpoint, StdUtils, TxUtils, SigHashPreimage} from '@opcat-labs/scrypt-ts-opcat';


/**
 * Library for verifying preimage.
 * @category Library
 * @onchain
 */
export class ContextUtils extends SmartContractLib {

  // The following arguments can be generated using sample code at
  // https://gist.github.com/scrypt-sv/f6882be580780a88984cee75dd1564c4.js
  @prop()
  static readonly privKey: PrivKey = PrivKey(0x26f00fe2340a84335ebdf30f57e9bb58487117b29355718f5e46bf5168d7df97n);
  @prop()
  static readonly pubKey: PubKey = PubKey(toByteString('02ba79df5f8ae7604a9830f03c7933028186aede0675a16f025dc4f8be8eec0382'));
  // invK is the modular inverse of k, the ephemeral key
  @prop()
  static readonly invK: bigint = 0xc8ffdbaa05d93aa4ede79ec58f06a72562048b775a3507c2bf44bde4f007c40an;
  // r is x coordinate of R, which is kG
  @prop()
  static readonly r: bigint = 0x1008ce7480da41702918d1ec8e6849ba32b4d65b1e40dc669c31a1e6306b266cn;
  // rBigEndian is the signed magnitude representation of r, in big endian
  @prop()
  static readonly rBigEndian: ByteString = toByteString('1008ce7480da41702918d1ec8e6849ba32b4d65b1e40dc669c31a1e6306b266c');


  @method()
  static normalize(k: bigint, modulus: bigint): bigint {
    const res: bigint = k % modulus;
    // ensure it's positive
    return (res < 0) ? res + modulus : res;
  }
  @method()
  static sign(h: bigint, privKey: PrivKey, inverseK: bigint, r: bigint, rBigEndian: ByteString, sigHashType: ByteString): Sig {
    // TODO: r * privKey can also be precomputed
    let s: bigint = inverseK * (h + r * (privKey as bigint));
    const N: bigint = 0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141n;
    s = ContextUtils.normalize(s, N);
    // lower S
    if (s > N / 2n) {
      s = N - s;
    }
    // require(s != 0);		// check offchain
    /*
    * DER: h + l + rh + rl + r + sh + sl + s + hashtype
    * note: r & s are at most 33 bytes, thus no need to convert endian of rl & sl
    */
    const rlen: bigint = BigInt(len(rBigEndian));
    const slen = len(intToByteString(s));
    // we convert s to 32 bytes, otherwise reverseByteString(, 32) fails when s is strictly less than 31 bytes (note: 31 bytes works)
    // slice it after reversing to remove extra leading zeros, otherwise strict DER rule fails it due to not minimally encoded
    const sBigEndian: ByteString = slice(reverseByteString(intToByteString(s, 32n), BigInt(32)), 32n - slen);

    const l: bigint = 4n + rlen + BigInt(slen);
    // rBigEndian must be mininally encoded, to conform to strict DER rule
    const rb: ByteString = toByteString('30') 
    + intToByteString(l) 
    + toByteString('02')
    + intToByteString(rlen) 
    + rBigEndian 
    + toByteString('02') 
    + intToByteString(slen) 
    + sBigEndian
    + toByteString(sigHashType);
    return Sig(rb);
  }

  @method()
  static fromBEUnsigned(b: ByteString): Int32 {
    // change endian first
    // append positive sign byte. This does not hurt even when sign bit is already positive
    return byteStringToInt(reverseByteString(b, 32n) + toByteString('00'));
  }

  /**
   * sign the transaction preimage
   * @param shPreimage - the transaction preimage
   * @returns a signature
   */
  @method()
  static checkSHPreimage(shPreimage: SHPreimage, sigHashType: ByteString): Sig {
    
    const preimage = ContextUtils.serializeSHPreimage(shPreimage);

    const h: ByteString = hash256(preimage);
    const sig: Sig = ContextUtils.sign(
      ContextUtils.fromBEUnsigned(h), 
      ContextUtils.privKey, 
      ContextUtils.invK,
       ContextUtils.r, 
       ContextUtils.rBigEndian,
        sigHashType);
    return sig;
  }

  @method()
  static serializeSHPreimage(shPreimage: SHPreimage): SigHashPreimage {
    assert(len(shPreimage.nVersion) == 4n, 'invalid length of nVersion');
    assert(len(shPreimage.hashPrevouts) == 32n, 'invalid length of hashPrevouts');
    assert(len(shPreimage.spentScriptHash) == 32n, 'invalid length of spentScriptHash');
    assert(len(shPreimage.spentDataHash) == 32n, 'invalid length of spentDataHash');
    assert(shPreimage.value >= 0n, 'invalid value of value');
    assert(len(shPreimage.nSequence) == 4n, 'invalid length of nSequence');
    assert(len(shPreimage.hashSpentAmounts) == 32n, 'invalid length of hashSpentAmounts');
    assert(len(shPreimage.hashSpentScriptHashes) == 32n, 'invalid length of hashSpentScriptHashes');
    assert(len(shPreimage.hashSpentDataHashes) == 32n, 'invalid length of hashSpentDataHashes');
    assert(len(shPreimage.hashSequences) == 32n, 'invalid length of hashSequences');
    assert(len(shPreimage.hashOutputs) == 32n, 'invalid length of hashOutputs');
    assert(shPreimage.inputIndex >= 0n, 'invalid value of inputIndex');
    assert(shPreimage.nLockTime >= 0n, 'invalid value of nLockTime');
    assert(shPreimage.sigHashType == 1n
      || shPreimage.sigHashType == 2n
      || shPreimage.sigHashType == 3n
      || shPreimage.sigHashType == 0x81n
      || shPreimage.sigHashType == 0x82n
      || shPreimage.sigHashType == 0x83n
      , 'invalid value of sigHashType');

    const preimage = shPreimage.nVersion
      + shPreimage.hashPrevouts
      + shPreimage.spentScriptHash
      + shPreimage.spentDataHash
      + TxUtils.satoshisToByteString(shPreimage.value)
      + shPreimage.nSequence
      + shPreimage.hashSpentAmounts
      + shPreimage.hashSpentScriptHashes
      + shPreimage.hashSpentDataHashes
      + shPreimage.hashSequences
      + shPreimage.hashOutputs
      + StdUtils.toLEUnsigned(shPreimage.inputIndex, 4n)
      + StdUtils.toLEUnsigned(shPreimage.nLockTime, 4n)
      + intToByteString(shPreimage.sigHashType, 4n);
    return SigHashPreimage(preimage);
  }

  /**
   * Verify that the prevouts context passed in by the user is authentic
   * @param prevouts prevouts context passed in by the user that need to be verified
   * @param prevout prevout context passed in by the user that need to be verified
   * @param t_hashPrevouts hashPrevouts in preimage which is trustable
   * @param t_inputIndex the index of the input, which is trustable
   * @returns the number of inputs, which is trustable
   */
  @method()
  static checkPrevouts(
    prevouts: Prevouts,
    t_hashPrevouts: ByteString,
    t_inputIndex: Int32,
    t_inputCount: Int32,
  ): Outpoint {
    // check prevouts
    assert(hash256(prevouts) == t_hashPrevouts, 'hashPrevouts mismatch');
    assert(t_inputIndex < t_inputCount, 'invalid prevouts');
    assert(t_inputCount == StdUtils.checkLenDivisibleBy(prevouts, 36n), 'invalid prevouts');

    const b = slice(prevouts, t_inputIndex * 36n, (t_inputIndex + 1n) * 36n);
    return {
      txHash: slice(b, 0n, 32n),
      outputIndex: StdUtils.byteStringToUInt32(slice(b, 32n, 36n)),
    }
  }

  /**
   * Check if the spent scripts array passed in matches the shaSpentScripts
   * @param spentScriptHashes array of spent scripts passed in that need to be verified
   * @param t_hashSpentScripts the hash of the merged spent scripts, which comes from preimage and is trustable
   * @param t_inputCount must be trustable, the number of inputs
   */
  @method()
  static checkSpentScripts(
    spentScriptHashes: SpentScriptHashes,
    t_hashSpentScripts: ByteString,
    t_inputCount: bigint,
  ): void {
    assert(hash256(spentScriptHashes) == t_hashSpentScripts, 'hashSpentScripts mismatch');
    assert(t_inputCount == StdUtils.checkLenDivisibleBy(spentScriptHashes, 32n), 'invalid spentScriptHashes');
  }

  /**
   * Check if the spent amounts array passed in matches the shaSpentAmounts
   * @param spentAmounts array of spent amounts passed in that need to be verified
   * @param t_hashSpentAmounts the hash of the merged spent amounts, which comes from preimage and is trustable
   * @param t_inputCount must be trustable, the number of inputs
   */
  @method()
  static checkSpentAmounts(
    spentAmounts: SpentAmounts,
    t_hashSpentAmounts: ByteString,
  ): Int32 {
    assert(hash256(spentAmounts) == t_hashSpentAmounts, 'hashSpentAmounts mismatch');
    return StdUtils.checkLenDivisibleBy(spentAmounts, 8n);
  }

  @method()
  static checkSpentDataHashes(
    spentDataHashes: ByteString,
    t_hashSpentDataHashes: ByteString,
    t_inputCount: bigint,
  ): void {
    assert(hash256(spentDataHashes) == t_hashSpentDataHashes, 'hashSpentDataHashes mismatch');
    assert(t_inputCount == StdUtils.checkLenDivisibleBy(spentDataHashes, 32n), 'invalid spentDataHashes');
  }


  @method()
  static getSpentScriptHash(
    spentScriptHashes: SpentScriptHashes,
    inputIndex: Int32,
  ): ByteString {
    return slice(spentScriptHashes, inputIndex * 32n, (inputIndex + 1n) * 32n);
  }

  @method()
  static getSpentAmount(
    spentAmounts: SpentAmounts,
    inputIndex: Int32,
  ): Int32 {
    return StdUtils.fromLEUnsigned(slice(spentAmounts, inputIndex * 8n, (inputIndex + 1n) * 8n));
  }

  @method()
  static getSpentDataHash(
    spentDataHashes: ByteString,
    inputIndex: Int32,
  ): ByteString {
    return slice(spentDataHashes, inputIndex * 32n, (inputIndex + 1n) * 32n);
  }

  @method()
  static checknLockTime(
    shPreimage: SHPreimage,
    nlockTime: Int32,
  ) : boolean {
    const nSequence = StdUtils.fromLEUnsigned(shPreimage.nSequence);
    return (nSequence < 4294967295n && (nlockTime < 500000000n ? shPreimage.nLockTime < 500000000n : true) && shPreimage.nLockTime >= nlockTime)
  }
}
