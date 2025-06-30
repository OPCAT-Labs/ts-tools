import {
    assert,
    ByteString,
    method,
    SmartContract,
    FixedArray,
    TxUtils,
} from '@opcat-labs/scrypt-ts-opcat'

export type CandidateName = ByteString

export type Candidate = {
    name: CandidateName
    votesReceived: bigint
}
export const N = 10

export type VotingState = {
    candidates: FixedArray<Candidate, typeof N>
}

export class Voting extends SmartContract<VotingState> {


    constructor() {
        super()
    }

    /**
     * vote for a candidate
     * @param candidate candidate's name
     */
    @method()
    public vote(candidate: CandidateName) {
        this.increaseVotesReceived(candidate)
        // output containing the latest state and the same balance
        let outputs: ByteString = TxUtils.buildDataOutput(this.ctx.spentScriptHash, this.ctx.value, Voting.stateHash(this.state))
        outputs += this.buildChangeOutput()
        assert(this.checkOutputs(outputs), 'hashOutputs mismatch')
    }

    @method()
    increaseVotesReceived(candidate: CandidateName): void {
        for (let i = 0; i < N; i++) {
            if (this.state.candidates[i].name == candidate) {
                this.state.candidates[i].votesReceived++
            }
        }
    }
}
