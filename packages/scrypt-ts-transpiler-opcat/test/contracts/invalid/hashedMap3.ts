import {HashedMap, ByteString, SmartContract, method, toByteString, assert, prop} from '@opcat-labs/scrypt-ts-opcat'

export type HashedMap3State = {
    m: HashedMap<ByteString, ByteString, 1>
}


/**
 * Cannot declare a property with type HashedMap
 */
export class HashedMap3 extends SmartContract<HashedMap3State> {

    @prop()
    p1: HashedMap3State

    constructor(p1: HashedMap3State) {
        super(...arguments);
        this.p1 = p1;
    }

    @method()
    public unlock() {
        this.state.m.get(toByteString('01'))
        assert(true);
    }
}