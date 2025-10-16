import {HashedMap, ByteString, SmartContract, method, toByteString, assert} from '@opcat-labs/scrypt-ts-opcat'

export type HashedMap1State = {
    m: HashedMap<ByteString, ByteString, 1>
}


/**
 * cannot call stateHash in private function if the state contains hashedMap
 */
export class HashedMap1 extends SmartContract<HashedMap1State> {
    @method()
    public unlock() {
        this.state.m.get(toByteString('01'))
        this.p1()
        assert(true);
    }

    @method()
    private p1(): ByteString {
        return HashedMap1.stateHash(this.state)
    }

}