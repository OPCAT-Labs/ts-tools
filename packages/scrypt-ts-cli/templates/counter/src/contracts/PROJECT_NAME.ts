import {
    method,
    SmartContract,
    assert,
    sha256,
    Int32,
    TxUtils,
    StructObject,
} from '@opcat-labs/scrypt-ts'

export interface PROJECT_NAMEState extends StructObject {
    count: Int32
}

export class PROJECT_NAME extends SmartContract<PROJECT_NAMEState> {
    @method()
    public increase() {
        this.state.count++
        
        const nextOutput = TxUtils.buildDataOutput(this.ctx.spentScriptHash, this.ctx.value, PROJECT_NAME.stateHash(this.state))
        const outputs = nextOutput + this.buildChangeOutput()

        assert(
            this.checkOutputs(outputs),
            'Outputs mismatch with the transaction context'
        )
    }
}
