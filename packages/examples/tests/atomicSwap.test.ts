import { expect, use } from 'chai'
import {
    sha256,
    toByteString,
    deploy,
    call,
    IExtPsbt,
    PubKey,
} from '@opcat-labs/scrypt-ts-opcat'
import { AtomicSwap } from '..'
import { getDefaultSigner, getDefaultProvider, getRandomSigner } from './utils/helper'
import chaiAsPromised from 'chai-as-promised'
use(chaiAsPromised)

describe('Test SmartContract `AtomicSwap`', async () => {
    let contract: AtomicSwap

    const provider = getDefaultProvider()
    const aliceSigner = getDefaultSigner()
    const bobSigner = getRandomSigner()
    const lockTimeMin = 1673510000n
    const x = toByteString(
        'f00cfd8df5f92d5e94d1ecbd9b427afd14e03f8a3292ca4128cd59ef7b9643bc'
    )
    const xHash = sha256(x)
    const alicePubKey = await aliceSigner.getPublicKey();
    const bobPubKey = await bobSigner.getPublicKey();

    before(async () => {

        contract = new AtomicSwap(
            PubKey(alicePubKey),
            PubKey(bobPubKey),
            xHash,
            lockTimeMin
        )
    })

    it('should pass the public method unit test successfully.', async () => {

        const deployPsbt = await deploy(aliceSigner, provider, contract)

        expect(deployPsbt.extractTransaction().id).to.have.length(64)

        const callPsbt = await call(aliceSigner, provider, contract, (contract: AtomicSwap, psbt: IExtPsbt) => {
            const sig = psbt.getSig(0, { publicKey: alicePubKey });
            contract.unlock(x, sig)
        })

        expect(callPsbt.extractTransaction().id).to.have.length(64)
    })

    it('should pass cancel.', async () => {

        const deployPsbt = await deploy(aliceSigner, provider, contract)

        expect(deployPsbt.extractTransaction().id).to.have.length(64)

        const callPsbt = await call(bobSigner, provider, contract, (contract: AtomicSwap, psbt: IExtPsbt) => {
            const sig = psbt.getSig(0, { publicKey: bobPubKey });
            contract.cancel(sig)
        }, {
            lockTime: 1673523720,
            sequence: 1,
        })

        expect(callPsbt.extractTransaction().id).to.have.length(64)
    })
})
