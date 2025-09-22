import { assert, ByteString, FixedArray, HashedMap, method, SmartContract, TxUtils, UInt64 } from "@opcat-labs/scrypt-ts-opcat"

export type Struct1 = {
    a: UInt64
    map: HashedMap<ByteString, ByteString, 1>
}

export type Struct2 = {
    y: FixedArray<Struct1, 2>
}

export type TestHashedMap2State = {
    x: Struct2
}
export class TestHashedMap2 extends SmartContract<TestHashedMap2State> {
    @method()
    public changeMap(
        key1: ByteString,
        value1: ByteString,
        key2: ByteString,
        value2: ByteString
    ) {
        this.state.x.y[0].map.set(key1, value1);
        this.state.x.y[1].map.set(key2, value2);
        const nextOutput = TxUtils.buildDataOutput(this.ctx.spentScriptHash, this.ctx.value, TestHashedMap2.stateHash(this.state));
        const outputs = nextOutput + this.buildChangeOutput();
        assert(this.checkOutputs(outputs), 'Outputs is not valid');
    }
}