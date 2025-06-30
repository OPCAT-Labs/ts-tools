import { expect, use } from 'chai'
import { Crowdfund } from '@opcat-labs/examples'
import { getDefaultProvider, getDefaultSigner, getRandomSigner } from './utils/helper'
import chaiAsPromised from 'chai-as-promised'
import { call, deploy, IExtPsbt, PubKey } from '@opcat-labs/scrypt-ts-opcat'
use(chaiAsPromised)


describe('Test SmartContract `Crowdfund`', async () => {
    // JS timestamps are in milliseconds, so we divide by 1000 to get a UNIX timestamp
    const deadline = Math.round(new Date('2020-01-03').valueOf() / 1000)
    const target = BigInt(1)

    let crowdfund: Crowdfund

    const provider = getDefaultProvider()
    const recipientSigner = getDefaultSigner()
    const contributorSigner = getRandomSigner()
    const recipientPublickey = await recipientSigner.getPublicKey();
    const recipientAddress = await recipientSigner.getAddress();
    const contributorPublickey = await contributorSigner.getPublicKey();

    before(async () => {
        crowdfund = new Crowdfund(
            PubKey(recipientPublickey),
            PubKey(contributorPublickey),
            BigInt(deadline),
            target
        )
    })

    it('should collect fund success', async () => {
        const deployPsbt = await deploy(recipientSigner, provider, crowdfund)

        expect(deployPsbt.extractTransaction().id).to.have.length(64)

        const callPsbt = await call(recipientSigner, provider, crowdfund, (contract: Crowdfund, psbt: IExtPsbt) => {
            const sig = psbt.getSig(0, {
                publicKey: recipientPublickey,
            })
            contract.collect(sig)
        }, {
            changeAddress: recipientAddress
        })

        expect(callPsbt.extractTransaction().id).to.have.length(64)
    })

    it('should success when refund', async () => {

        const deployPsbt = await deploy(recipientSigner, provider, crowdfund)

        expect(deployPsbt.extractTransaction().id).to.have.length(64)
        const today = Math.round(new Date().valueOf() / 1000)
        const callPsbt = await call(contributorSigner, provider, crowdfund, (contract: Crowdfund, psbt: IExtPsbt) => {
            const sig = psbt.getSig(0, {
                publicKey: contributorPublickey,
            })
            contract.refund(sig)
        }, {
            lockTime: today,
            sequence: 0xfffffff1,
        })
        expect(callPsbt.extractTransaction().id).to.have.length(64)
    })

    it('should fail when refund before deadline', async () => {

        const deployPsbt = await deploy(recipientSigner, provider, crowdfund)

        expect(deployPsbt.extractTransaction().id).to.have.length(64)
        const today = Math.round(new Date('2020-01-01').valueOf() / 1000)

        await expect(call(contributorSigner, provider, crowdfund, (contract: Crowdfund, psbt: IExtPsbt) => {
            const sig = psbt.getSig(0, {
                publicKey: contributorPublickey,
            })
            contract.refund(sig)
        }, {
            lockTime: today,
            sequence: 0xfffffff1,
        })).to.be.rejectedWith(
            /deadline not yet reached/
        )
    })
})
