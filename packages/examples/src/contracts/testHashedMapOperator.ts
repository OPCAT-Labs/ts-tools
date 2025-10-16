import { assert, ByteString, ContextUtils, method, prop, SmartContract, TxUtils } from "@opcat-labs/scrypt-ts-opcat";
import { DummyStruct, TestHashedMapMainState, TestHashedMapStateLib } from "./testHashedMapStateLib.js"


export class TestHashedMapOperator extends SmartContract {
    @prop()
    mainScriptHash: ByteString;

    constructor(mainScriptHash: ByteString) {
        super(mainScriptHash);
        this.mainScriptHash = mainScriptHash;
    }

    @method()
    public changeMap1(
        mainState: TestHashedMapMainState,

        key1: bigint,
        value1: ByteString,
        key2: bigint,
        value2: ByteString
    ) {
        assert(ContextUtils.getSpentScriptHash(this.ctx.spentScriptHashes, 0n) == this.mainScriptHash, 'Main script hash is not valid');

        mainState.map1.set(key1, value1);
        mainState.map1.set(key2, value2);

        const mainSatoshis = ContextUtils.getSpentAmount(this.ctx.spentAmounts, 0n)
        const nextOutput = TxUtils.buildDataOutput(this.mainScriptHash, mainSatoshis, TestHashedMapStateLib.stateHash(mainState));
        const outputs = nextOutput + this.buildChangeOutput();
        assert(this.checkOutputs(outputs), 'Outputs is not valid');
    }

    @method()
    public changeMap2(
        mainState: TestHashedMapMainState,
        key: ByteString,
        value: DummyStruct
    ) {
        assert(ContextUtils.getSpentScriptHash(this.ctx.spentScriptHashes, 0n) == this.mainScriptHash, 'Main script hash is not valid');

        mainState.map2.set(key, value);

        const mainSatoshis = ContextUtils.getSpentAmount(this.ctx.spentAmounts, 0n)
        const nextOutput = TxUtils.buildDataOutput(this.mainScriptHash, mainSatoshis, TestHashedMapStateLib.stateHash(mainState));
        const outputs = nextOutput + this.buildChangeOutput();
        assert(this.checkOutputs(outputs), 'Outputs is not valid');
    }

    @method()
    public changeBoth(
        mainState: TestHashedMapMainState,
        key1: bigint,
        value1: ByteString,
        key2: bigint,
        value2: ByteString,
        key3: ByteString,
        value3: DummyStruct
    ) {
        assert(ContextUtils.getSpentScriptHash(this.ctx.spentScriptHashes, 0n) == this.mainScriptHash, 'Main script hash is not valid');

        mainState.map1.set(key1, value1);
        mainState.map1.set(key2, value2);
        mainState.map2.set(key3, value3);

        const mainSatoshis = ContextUtils.getSpentAmount(this.ctx.spentAmounts, 0n)
        const nextOutput = TxUtils.buildDataOutput(this.mainScriptHash, mainSatoshis, TestHashedMapStateLib.stateHash(mainState));
        const outputs = nextOutput + this.buildChangeOutput();
        assert(this.checkOutputs(outputs), 'Outputs is not valid');
    }

    @method()
    public justUnlock() {
        assert(true, 'Just unlock');
    }
}