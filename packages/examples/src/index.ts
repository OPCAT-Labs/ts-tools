// The things that are being exported here will be able
// to be imported in another package.
import { Examples } from './contracts/examples.js'
import { Ackermann } from './contracts/ackermann.js'
import { ArraysTest } from './contracts/array.js'
import { AtomicSwap } from './contracts/atomicSwap.js'
import { Auction, AuctionState } from './contracts/auction.js'
import { B2GCounter, CounterState } from './contracts/b2GCounter.js'
// run npm run compile to generate artifacts
import examples from '../artifacts/contracts/examples.json'
import ackermann from '../artifacts/contracts/ackermann.json'
import array from '../artifacts/contracts/array.json'
import atomicSwap from '../artifacts/contracts/atomicSwap.json'
import auction from '../artifacts/contracts/auction.json'
import b2GCounter from '../artifacts/contracts/b2GCounter.json'
(() => {
    Examples.loadArtifact(examples)
    Ackermann.loadArtifact(ackermann)
    ArraysTest.loadArtifact(array)
    AtomicSwap.loadArtifact(atomicSwap)
    Auction.loadArtifact(auction)
    B2GCounter.loadArtifact(b2GCounter)
})()

export { Examples, Ackermann, ArraysTest, AtomicSwap, Auction, type AuctionState, B2GCounter, type CounterState}
