/**
A Bitcoin contract which is instantiated with a shasum of known data xor'ed with a pubKey
**/

import {
    SmartContract,
    prop,
    ByteString,
    Sig,
    assert,
    sha256,
    PubKey,
    method,
    byteStringToInt,
    intToByteString,
    xor,
} from '@opcat-labs/scrypt-ts-opcat'

export class XORPuzzle extends SmartContract {
    @prop()
    dataXORPubKey: ByteString

    constructor(dataXORPubKey: ByteString) {
        super(...arguments)
        this.dataXORPubKey = dataXORPubKey
    }

    @method()
    public unlock(sig: Sig, pubKey: PubKey, data: ByteString) {
        const xorResult = xor(byteStringToInt(data), byteStringToInt(sha256(pubKey + data)));
        assert(intToByteString(xorResult) == this.dataXORPubKey)
        assert(this.checkSig(sig, pubKey))
    }
}
