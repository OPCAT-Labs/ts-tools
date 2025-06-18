import {
    method,
    SmartContract,
    assert,
    sha256,
    Int32,
    TxUtils,
    StructObject,
} from '@opcat-labs/scrypt-ts-opcat'

export interface PROJECT_NAMEState extends StructObject {
    count: Int32
}

export class PROJECT_NAME extends SmartContract<PROJECT_NAMEState> {
    @method()
    public increase() {
        this.state.count++

        this.appendStateOutput(
            // new output of the contract
            TxUtils.buildOutput(this.ctx.spentScript, this.ctx.spentAmount),
            // new state hash of the contract
            PROJECT_NAME.stateHash(this.state)
        )

        const outputs = this.buildStateOutputs() + this.buildChangeOutput()

        assert(
            this.checkOutputs(outputs),
            'Outputs mismatch with the transaction context'
        )
    }
}
