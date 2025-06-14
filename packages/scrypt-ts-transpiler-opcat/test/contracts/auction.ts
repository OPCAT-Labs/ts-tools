import {
  assert,
  ByteString,
  hash256,
  Int32,
  method,
  prop,
  PubKey,
  PubKeyHash,
  sha256,
  Sig,
  SmartContract,
  TxUtils,
  StdUtils,
} from '@scrypt-inc/scrypt-ts-btc';

export interface AuctionState {
  bidder: PubKeyHash;
  auctioneer: PubKey;
  auctionDeadline: Int32;
}

export class Auction extends SmartContract<AuctionState> {
  // bid with a higher offer
  @method()
  public bid(bidder: PubKeyHash, bid: Int32, spentAmountVal: Int32) {
    assert(bid > spentAmountVal, 'the auction bid is lower than the current highest bid');
    assert(this.ctx.spentAmount == TxUtils.toSatoshis(spentAmountVal), 'spentAmount check failed');

    const highestBidder: PubKeyHash = this.state.bidder;
    this.state.bidder = bidder;

    // auction continues with a higher bidder
    this.appendStateOutput(
      TxUtils.buildOutput(this.ctx.spentScript, TxUtils.toSatoshis(bid)),
      Auction.stateHash(this.state),
    );

    const refundScript: ByteString = TxUtils.buildP2PKHScript(highestBidder);
    const refundOutput: ByteString = TxUtils.buildOutput(refundScript, this.ctx.spentAmount);

    assert(
      this.ctx.shaOutputs == sha256(this.buildStateOutputs() + this.buildChangeOutput()),
      'shaOutputs check failed',
    );

    // refund previous highest bidder

    const outputs: ByteString = this.buildStateOutputs() + refundOutput + this.buildChangeOutput();

    assert(sha256(outputs) == this.ctx.shaOutputs, 'shaOutputs check failed');
  }

  @method()
  public close(sig: Sig, nLockTime: Int32) {
    assert(StdUtils.checkInt32(nLockTime, this.ctx.nLockTime), 'checkInt32 fail');
    assert(this.cltv(nLockTime), 'auction is not over yet');
    assert(this.checkSig(sig, this.state.auctioneer, 'auctioneer signature check failed'));
  }
}
