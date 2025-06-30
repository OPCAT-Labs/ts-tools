// The things that are being exported here will be able
// to be imported in another package.
import { Examples } from './contracts/examples.js'
import { Ackermann } from './contracts/ackermann.js'
import { ArraysTest } from './contracts/array.js'
import { AtomicSwap } from './contracts/atomicSwap.js'
import { Auction, AuctionState } from './contracts/auction.js'
import { B2GCounter, CounterState } from './contracts/b2GCounter.js'
import { CoinToss } from './contracts/cointoss.js'
import { Crowdfund } from './contracts/crowdfund.js'
import { Matrix } from './contracts/matrix.js'
import { ModExp } from './contracts/modEXP.js'
import { LamportP2PK, LamportPubKey, LamportSig } from './contracts/lamportSig.js'
import { HashArray, MultiPartyHashPuzzle, PreimageArray } from './contracts/multiPartyHashPuzzle.js'
import { Rule110State, Rule110 } from './contracts/rule110.js'
import { ShiftTest } from './contracts/shift.js'
import { State, TuringMachineState, TuringMachine } from './contracts/turingMachine.js'
import { VotingState, Candidate, Voting, CandidateName } from './contracts/voting.js'
import { XORPuzzle } from './contracts/xorpuzzle.js'
import { TimedCommit } from './contracts/timedCommit.js'
import { MultiSigPayment } from './contracts/multiSig.js'


// run npm run compile to generate artifacts
import examples from '../artifacts/contracts/examples.json'
import ackermann from '../artifacts/contracts/ackermann.json'
import array from '../artifacts/contracts/array.json'
import atomicSwap from '../artifacts/contracts/atomicSwap.json'
import auction from '../artifacts/contracts/auction.json'
import b2GCounter from '../artifacts/contracts/b2GCounter.json'
import cointoss from '../artifacts/contracts/cointoss.json'
import crowdfund from '../artifacts/contracts/crowdfund.json'
import matrix from '../artifacts/contracts/matrix.json'
import modEXP from '../artifacts/contracts/modEXP.json'
import lamportSig from '../artifacts/contracts/lamportSig.json'
import multiPartyHashPuzzle from '../artifacts/contracts/multiPartyHashPuzzle.json'
import rule110 from '../artifacts/contracts/rule110.json'
import shift from '../artifacts/contracts/shift.json'
import turingMachine from '../artifacts/contracts/turingMachine.json'
import voting from '../artifacts/contracts/voting.json'
import xorpuzzle from '../artifacts/contracts/xorpuzzle.json'
import timedCommit from '../artifacts/contracts/timedCommit.json'
import multiSig from '../artifacts/contracts/multiSig.json'




(() => {
    Examples.loadArtifact(examples)
    Ackermann.loadArtifact(ackermann)
    ArraysTest.loadArtifact(array)
    AtomicSwap.loadArtifact(atomicSwap)
    Auction.loadArtifact(auction)
    B2GCounter.loadArtifact(b2GCounter)
    CoinToss.loadArtifact(cointoss)
    Crowdfund.loadArtifact(crowdfund)
    Matrix.loadArtifact(matrix)
    ModExp.loadArtifact(modEXP)
    LamportP2PK.loadArtifact(lamportSig)
    MultiPartyHashPuzzle.loadArtifact(multiPartyHashPuzzle)
    Rule110.loadArtifact(rule110)
    ShiftTest.loadArtifact(shift)
    TuringMachine.loadArtifact(turingMachine)
    Voting.loadArtifact(voting)
    XORPuzzle.loadArtifact(xorpuzzle)
    TimedCommit.loadArtifact(timedCommit)
    MultiSigPayment.loadArtifact(multiSig)
})()

export {
    Examples, Ackermann, ArraysTest, AtomicSwap, Auction, type AuctionState, B2GCounter,
    type CounterState, CoinToss, Crowdfund, Matrix, ModExp, LamportP2PK, type LamportPubKey, type LamportSig,
    type HashArray, MultiPartyHashPuzzle, type PreimageArray, type Rule110State, Rule110,
    ShiftTest, TuringMachine, type TuringMachineState, type State, Voting, type VotingState, type Candidate,
    type CandidateName, XORPuzzle, TimedCommit, MultiSigPayment
}
