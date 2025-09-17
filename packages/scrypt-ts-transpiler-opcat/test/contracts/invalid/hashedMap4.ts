import {HashedMap, ByteString, SmartContract, method, toByteString, assert} from '@opcat-labs/scrypt-ts-opcat'

export type HashedMap4State = {
    m: HashedMap<ByteString, ByteString, 1>
}


/**
 * Cannot call new HashedMap()
 */
export class HashedMap4 extends SmartContract<HashedMap4State> {


    @method()
    public unlock() {
        const s: HashedMap4State = {
            m: new HashedMap<ByteString, ByteString, 1>([])
        }
        assert(true);
    }
}