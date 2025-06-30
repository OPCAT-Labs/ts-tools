import { crypto, PublicKey, Interpreter } from '@opcat-labs/opcat';
import { Sig, PubKey } from '../types/index.js';
import { hash256, toByteString } from '../fns/index.js';
import { AbstractContract } from '../abstractContract.js';
import { encodeSHPreimage } from '../../utils/preimage.js';


/**
   * @ignore
   * @param signature 
   * @returns true signature valid.
   */
function checkSignatureEncoding(signature: Sig): boolean {

  const buf = Buffer.from(toByteString(signature), 'hex');
  let sig: crypto.Signature

  // Empty signature. Not strictly DER encoded, but allowed to provide a
  // compact way to provide an invalid signature for use with CHECK(MULTI)SIG
  if (buf.length === 0) {
    return true
  }

  if (!crypto.Signature.isTxDER(buf)) {
    return false
  } else if ((Interpreter.DEFAULT_FLAGS & Interpreter.SCRIPT_VERIFY_LOW_S) !== 0) {
    sig = crypto.Signature.fromTxFormat(buf)
    if (!sig.hasLowS()) {
      return false
    }
  } else if ((Interpreter.DEFAULT_FLAGS & Interpreter.SCRIPT_VERIFY_STRICTENC) !== 0) {
    sig = crypto.Signature.fromTxFormat(buf)
    if (!sig.hasDefinedHashtype()) {
      return false
    }

  }

  return true
}


/**
 * @ignore
 * @param publickey 
 * @returns true publickey valid.
 */
function checkPubkeyEncoding(publickey: PubKey) {
  if ((Interpreter.DEFAULT_FLAGS & Interpreter.SCRIPT_VERIFY_STRICTENC) !== 0 && !PublicKey.isValid(toByteString(publickey))) {
    return false
  }
  return true
}

/**
 * @ignore
 * @param self
 * @param signature
 * @param publickey
 * @returns
 */
export function checkSigImpl(self: AbstractContract, signature: Sig, publickey: PubKey): boolean {

  if (!checkSignatureEncoding(signature) || !checkPubkeyEncoding(publickey)) {
    return false
  }

  let fSuccess = false;

  const bufSig = Buffer.from(signature, 'hex');
  const bufPubkey = Buffer.from(publickey, 'hex');

  try {

    const sig = crypto.Signature.fromTxFormat(bufSig);
    const pubkey = PublicKey.fromBuffer(bufPubkey, false);

    const shPreimage = self.ctx;

    const byteString = encodeSHPreimage(shPreimage);

    const hashbuf = Buffer.from(hash256(byteString), 'hex').reverse();

    fSuccess = crypto.ECDSA.verify(hashbuf, sig, pubkey, 'little')
  } catch (_err) {
    // invalid sig or pubkey
    fSuccess = false
  }


  return fSuccess
}


/**
 * @ignore
 * @param self 
 * @param signatures 
 * @param publickeys 
 * @returns 
 */
export function checkMultiSigImpl(self: AbstractContract, signatures: Sig[], publickeys: PubKey[]): boolean {


  for (let i = 0; i < signatures.length; i++) {
    if (!checkSignatureEncoding(signatures[i])) {
      return false
    }
  }

  for (let i = 0; i < publickeys.length; i++) {
    if (!checkPubkeyEncoding(publickeys[i])) {
      return false
    }
  }

  const shPreimage = self.ctx;

  const pubKeysVisited = new Set()
  let fSuccess = false;
  for (let i = 0; i < signatures.length; i++) {
    const sig = crypto.Signature.fromTxFormat(Buffer.from(toByteString(signatures[i]), 'hex'));

    let noPubKeyMatch = true
    for (let j = 0; j < publickeys.length; j++) {
      if (pubKeysVisited.has(j)) {
        continue
      }

      pubKeysVisited.add(j)
      const pubkey = PublicKey.fromBuffer(Buffer.from(toByteString(publickeys[j]), 'hex'), false);


      try {

        const byteString = encodeSHPreimage(shPreimage);

        const hashbuf = Buffer.from(hash256(byteString), 'hex').reverse();

        fSuccess = crypto.ECDSA.verify(hashbuf, sig, pubkey, 'little')


        if (fSuccess) {
          noPubKeyMatch = false
          break
        }
      } catch (_err) {
        continue
      }
    }

    if (noPubKeyMatch) {
      return false
    }

  }

  return true;

}