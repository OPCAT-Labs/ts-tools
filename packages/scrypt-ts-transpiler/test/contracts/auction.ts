import {
    assert,
    ByteString,
    method,
    prop,
    PubKey,
    Sig,
    SmartContract,
    pubKey2Addr,
    TxUtils,
} from '@opcat-labs/scrypt-ts'

export type AuctionState = {
    bidder: PubKey
};


/*
 * Read Medium article about this contract:
 * https://medium.com/@xiaohuiliu/auction-on-bitcoin-4ba2b6c18ba7
 */
export class Auction extends SmartContract<AuctionState> {


    // The auctioneer's public key.
    @prop()
    readonly auctioneer: PubKey

    // Deadline of the auction. Can be block height or timestamp.
    @prop()
    readonly auctionDeadline: bigint

    constructor(auctioneer: PubKey, auctionDeadline: bigint) {
        super(...arguments)
        this.auctioneer = auctioneer
        this.auctionDeadline = auctionDeadline
    }

    // Call this public method to bid with a higher offer.
    @method()
    public bid(bidder: PubKey, bid: bigint) {
        const highestBid: bigint = this.ctx.value
        assert(
            bid > highestBid,
            'the auction bid is lower than the current highest bid'
        )

        // Change the public key of the highest bidder.
        const highestBidder: PubKey = this.state.bidder;
        this.state.bidder = bidder

        // Auction continues with a higher bidder.
        const auctionOutput: ByteString = TxUtils.buildDataOutput(this.ctx.spentScriptHash, bid, Auction.stateHash(this.state));

        // Refund previous highest bidder.
        const refundOutput: ByteString = TxUtils.buildP2PKHOutput(highestBid, pubKey2Addr(highestBidder))
        let outputs: ByteString = auctionOutput + refundOutput

        // Add change output.
        outputs += this.buildChangeOutput()

        assert(
            this.checkOutputs(outputs),
            'hashOutputs check failed'
        )
    }

    // Close the auction if deadline is reached.
    @method()
    public close(sig: Sig) {
        // Check auction deadline.
        assert(this.timeLock(this.auctionDeadline), 'deadline not reached')

        // Check signature of the auctioneer.
        assert(this.checkSig(sig, this.auctioneer), 'signature check failed')
    }
}
