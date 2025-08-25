import { expect, use } from 'chai'
import {
    deploy,
    IExtPsbt,
    PubKey,
    Signer,
    UtxoProvider,
    ChainProvider,
    ExtPsbt,
    fromSupportedNetwork,
    markSpent,
} from '@opcat-labs/scrypt-ts'
import { Auction } from '@opcat-labs/examples'
import { getDefaultSigner, getDefaultProvider, getRandomSigner } from './utils/helper'
import chaiAsPromised from 'chai-as-promised'
import { PublicKey } from '@opcat-labs/opcat'
use(chaiAsPromised)



 async function callbid(
    signer: Signer,
    provider: UtxoProvider & ChainProvider,
    contract: Auction,
    bid: bigint,
  ): Promise<{
    psbt: ExtPsbt;
    contract: Auction;
  }> {
    const address = await signer.getAddress();
    const publicKey = await signer.getPublicKey();
  
    const feeRate = await provider.getFeeRate();
  
    const utxos = await provider.getUtxos(address);
  
    const network = await provider.getNetwork();
  
    const psbt = new ExtPsbt({ network: network })
      .addContractInput(contract, (auction) => {
        auction.bid(PubKey(publicKey), bid);
    })
      .spendUTXO(utxos.slice(0, 10));
  
    const next = contract.next({
        bidder: PubKey(publicKey),
    })
    psbt.addContractOutput(next, Number(bid));
    const oldBidder = contract.state.bidder;

    const balance = contract.utxo!.satoshis;

    const oldBidderAddr = PublicKey.fromString(oldBidder).toAddress(fromSupportedNetwork(network)).toString();
    psbt.addOutput({
        address: oldBidderAddr,
        value: BigInt(balance),
        data: Uint8Array.from([]),
    });
  
    psbt.change(address, feeRate);
  

    psbt.seal();
  
    const signedPsbtHex = await signer.signPsbt(psbt.toHex(), psbt.psbtOptions());
    const signedPsbt = psbt.combine(ExtPsbt.fromHex(signedPsbtHex)).finalizeAllInputs();
    const callTx = signedPsbt.extractTransaction();
    await provider.broadcast(callTx.toHex());
    markSpent(provider, callTx);
    return {
      psbt: signedPsbt,
      contract: next,
    }
  }
  

describe('Test SmartContract `Auction`', async () => {
    let contract: Auction

    const auctioneerSigner = getDefaultSigner()
    const aliceSigner = getRandomSigner()
    const bobSigner = getRandomSigner()
    const provider = getDefaultProvider()


    const auctionDeadline = Math.round(new Date('2020-01-03').valueOf() / 1000)


    const auctioneerPubKey = await auctioneerSigner.getPublicKey();
    const alicePubKey = await aliceSigner.getPublicKey();

    before(async () => {
        contract = new Auction(PubKey(auctioneerPubKey), BigInt(auctionDeadline))
        contract.state = {
            bidder: PubKey(auctioneerPubKey)
        }
    })

    it('should pass the public method unit test successfully.', async () => {

        const deployPsbt = await deploy(auctioneerSigner, provider, contract, 1000)

        expect(deployPsbt.extractTransaction().id).to.have.length(64)

        const {psbt: aliceBidPsbt, contract: aliceContract} = await callbid(aliceSigner, provider, contract, 2000n)

        expect(aliceBidPsbt.extractTransaction().id).to.have.length(64)

        const {psbt: bobBidPsbt} = await callbid(bobSigner, provider, aliceContract, 3000n)

        expect(bobBidPsbt.extractTransaction().id).to.have.length(64)
    })


    it('should throw', async () => {

        const deployPsbt = await deploy(auctioneerSigner, provider, contract, 1000)

        expect(deployPsbt.extractTransaction().id).to.have.length(64)

        const {psbt: aliceBidPsbt, contract: aliceContract} = await callbid(aliceSigner, provider, contract, 2000n)

        expect(aliceBidPsbt.extractTransaction().id).to.have.length(64)

        await expect(callbid(bobSigner, provider, aliceContract, 300n)).to.be.rejectedWith(/the auction bid is lower than the current highest bid/)
    })
})
