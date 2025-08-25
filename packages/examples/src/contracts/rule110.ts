import {
    ByteString,
    SmartContract,
    assert,
    slice,
    hash256,
    method,
    prop,
    toByteString,
    TxUtils,
} from '@opcat-labs/scrypt-ts'

export type Rule110State = {
    board: ByteString;
}

export class Rule110 extends SmartContract<Rule110State> {
    static readonly N: bigint = 5n //size of board
    static readonly N2: bigint = 3n //size of board
    @prop()
    static LIVE: ByteString = toByteString('01')
    @prop()
    static DEAD: ByteString = toByteString('00')



    @method()
    public play() {
        this.state.board = this.computeNewBoard(this.state.board)
        const output: ByteString =
            TxUtils.buildDataOutput(this.ctx.spentScriptHash, this.ctx.value, Rule110.stateHash(this.state)) +
            this.buildChangeOutput()

        assert(hash256(output) == this.ctx.hashOutputs)
    }

    @method()
    computeNewBoard(board: ByteString): ByteString {
        let res: ByteString = toByteString('')
        res += Rule110.DEAD
        for (let i = 0n; i < Rule110.N2; i++) {
            res += this.newState(slice(board, i, i + 3n))
        }
        res += Rule110.DEAD
        return res
    }

    @method()
    newState(arg: ByteString): ByteString {
        /*
          Current pattern	        111	110	101	100	011	010	001	000
          New state for center cell	 0	 1	 1	0	 1	 1	 1	 0
        */
        const a: ByteString = slice(arg, 0n, 1n)
        const b: ByteString = slice(arg, 1n, 2n)
        const c: ByteString = slice(arg, 2n, 3n)
        let res: ByteString = Rule110.LIVE
        if (a == Rule110.LIVE && b == Rule110.LIVE && c == Rule110.LIVE) {
            res = Rule110.DEAD
        }
        if (a == Rule110.LIVE && b == Rule110.DEAD && c == Rule110.DEAD) {
            res = Rule110.DEAD
        }
        if (a == Rule110.DEAD && b == Rule110.DEAD && c == Rule110.DEAD) {
            res = Rule110.DEAD
        }
        return res
    }
}
