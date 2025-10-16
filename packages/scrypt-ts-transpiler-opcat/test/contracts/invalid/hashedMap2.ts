import {HashedMap, ByteString, SmartContract, method, toByteString, assert} from '@opcat-labs/scrypt-ts-opcat'

export type HashedMap2State = {
    m: HashedMap<ByteString, ByteString, 1>
}


/**
 * Cannot call hashedMap .set/.get in private function
 */
export class HashedMap2 extends SmartContract<HashedMap2State> {
    @method()
    public unlock() {
        this.state.m.get(toByteString('01'))
        this.p1(this.state)
        assert(true);
    }

    @method()
    private p1(param: HashedMap2State): boolean {
        param.m.get(toByteString('01'));
        return true;
    }

}