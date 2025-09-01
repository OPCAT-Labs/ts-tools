import { assert, ByteString, HashedMap, method, Sha256, SmartContract, toByteString, TxUtils } from "@opcat-labs/scrypt-ts-opcat";

export type UserData = {
    colTokenScriptHash: ByteString
    colTokenAmount: bigint
    debtTokenScriptHash: ByteString
    debtTokenAmount: bigint
}

export type HashMapContractState = {
    map1: HashedMap<ByteString, UserData, 3>;
    h1: Sha256;
}

export class HashMapContract extends SmartContract<HashMapContractState> {
    @method()
    public unlock() {
        const val1 = this.state.map1.get(toByteString('01'))
        assert(val1.colTokenScriptHash === toByteString('0101'), 'val1 is not 01')

        const val2 = this.state.map1.get(toByteString('02'))
        assert(val2.colTokenScriptHash === toByteString('0202'), 'val2 is not 02')

        this.state.map1.set(toByteString('03'), {
            colTokenScriptHash: toByteString('030303'),
            colTokenAmount: 1n,
            debtTokenScriptHash: toByteString('030304'),
            debtTokenAmount: 2n
        })
        const val3 = this.state.map1.get(toByteString('03'))
        assert(val3.colTokenScriptHash === toByteString('030303'), 'val3 is not 03');

        const outputs = TxUtils.buildDataOutput(this.ctx.spentScriptHash,this.ctx.value,  HashMapContract.stateHash( this.state))
        assert(this.checkOutputs(outputs), 'outputs is not valid')
    }
}