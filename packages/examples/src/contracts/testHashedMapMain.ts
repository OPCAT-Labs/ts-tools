import { assert, ByteString, HashedMap, method, SmartContract, TxUtils } from "@opcat-labs/scrypt-ts-opcat"
import { DummyStruct, TestHashedMapMainState } from "./testHashedMapStateLib.js"

export class TestHashedMapMain extends SmartContract<TestHashedMapMainState> {
    @method()
    public changeMap1(
        key1: bigint,
        value1: ByteString,
        key2: bigint,
        value2: ByteString
    ) {
        this.state.map1.set(key1, value1);
        this.state.map1.set(key2, value2);
        const nextOutput = TxUtils.buildDataOutput(this.ctx.spentScriptHash, this.ctx.value, TestHashedMapMain.stateHash(this.state));
        const outputs = nextOutput + this.buildChangeOutput();
        assert(this.checkOutputs(outputs), 'Outputs is not valid');
    }

    @method()
    public changeMap2(
        key: ByteString,
        value: DummyStruct
    ) {
        this.state.map2.set(key, value);
        const nextOutput = TxUtils.buildDataOutput(this.ctx.spentScriptHash, this.ctx.value, TestHashedMapMain.stateHash(this.state));
        const outputs = nextOutput + this.buildChangeOutput();
        assert(this.checkOutputs(outputs), 'Outputs is not valid');
    }

    @method()
    public changeBoth(
        key1: bigint,
        value1: ByteString,
        key2: bigint,
        value2: ByteString,

        key3: ByteString,
        value3: DummyStruct
    ) {
        this.state.map1.set(key1, value1);
        this.state.map1.set(key2, value2);
        this.state.map2.set(key3, value3);
        const nextOutput = TxUtils.buildDataOutput(this.ctx.spentScriptHash, this.ctx.value, TestHashedMapMain.stateHash(this.state));
        const outputs = nextOutput + this.buildChangeOutput();
        assert(this.checkOutputs(outputs), 'Outputs is not valid');
    }

    @method()
    public justUnlock() {
        assert(true, 'Just unlock');
    }
}