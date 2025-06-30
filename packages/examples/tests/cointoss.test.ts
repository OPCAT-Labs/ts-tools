import { expect, use } from 'chai'
import {
    sha256,
    toByteString,
    deploy,
    call,
    IExtPsbt,
    PubKey,
    hash256,
} from '@opcat-labs/scrypt-ts-opcat'
import { CoinToss } from '@opcat-labs/examples'
import { getDefaultSigner, getDefaultProvider, getRandomSigner } from './utils/helper'
import chaiAsPromised from 'chai-as-promised'
use(chaiAsPromised)

describe('Test SmartContract `CoinToss`', async () => {
    let contract: CoinToss
    const provider = getDefaultProvider()
    const aliceSigner = getDefaultSigner()
    const bobSigner = getRandomSigner()
    const alicepublickey = await aliceSigner.getPublicKey();
    const bobpublickey = await bobSigner.getPublicKey();
    before(async () => {

    })

    it('alice win.', async () => {

        contract = new CoinToss(
            PubKey(alicepublickey),
            PubKey(bobpublickey),
            hash256(toByteString('alice', true)),
            hash256(toByteString('bob', true)),
            toByteString('n', true)
        )
        const deployPsbt = await deploy(aliceSigner, provider, contract)

        expect(deployPsbt.extractTransaction().id).to.have.length(64)

        const callPsbt = await call(aliceSigner, provider, contract, (contract: CoinToss, psbt: IExtPsbt) => {
            const sig = psbt.getSig(0, {
                publicKey: alicepublickey,
            })
            contract.toss(
                toByteString('alice', true),
                toByteString('bob', true),
                sig)
        })

        expect(callPsbt.extractTransaction().id).to.have.length(64)
    })

    it('bob win.', async () => {

        contract = new CoinToss(
            PubKey(alicepublickey),
            PubKey(bobpublickey),
            hash256(toByteString('alice', true)),
            hash256(toByteString('bob', true)),
            toByteString('alice', true)
        )
        const deployPsbt = await deploy(aliceSigner, provider, contract)

        expect(deployPsbt.extractTransaction().id).to.have.length(64)

        const callPsbt = await call(bobSigner, provider, contract, (contract: CoinToss, psbt: IExtPsbt) => {
            const sig = psbt.getSig(0, {
                publicKey: bobpublickey,
            })
            contract.toss(
                toByteString('alice', true),
                toByteString('bob', true),
                sig)
        })

        expect(callPsbt.extractTransaction().id).to.have.length(64)
    })
})
