import { assert, ByteString, HashedMap, method, Sha256, SmartContract, toByteString, TxUtils } from "@opcat-labs/scrypt-ts-opcat";


export type HashMapContractState = {
    map1: HashedMap<ByteString, ByteString, 3>;
    h1: Sha256;
}

export class HashMapContract extends SmartContract<HashMapContractState> {
    @method()
    public unlock() {
        const val1 = this.state.map1.get(toByteString('01'))
        assert(val1 === toByteString('0101'), 'val1 is not 01')

        const val2 = this.state.map1.get(toByteString('02'))
        assert(val2 === toByteString('0202'), 'val2 is not 02')

        this.state.map1.set(toByteString('03'), toByteString('030303'))
        const val3 = this.state.map1.get(toByteString('03'))
        assert(val3 === toByteString('030303'), 'val3 is not 03');    this.state.map1.set(toByteString('03'), toByteString('030304'))

        const outputs = TxUtils.buildDataOutput(this.ctx.spentScriptHash,this.ctx.value,  HashMapContract.stateHash( this.state))
        assert(this.checkOutputs(outputs), 'outputs is not valid')
    }
}