import { expect, use } from 'chai'
import { getDefaultProvider, getDefaultSigner, getRandomSigner } from './utils/helper'
import { TimedCommit } from '@opcat-labs/examples'
import { PubKey, toByteString, Signer, ByteString, deploy, call, sha256, ExtPsbt } from '@opcat-labs/scrypt-ts'
import chaiAsPromised from 'chai-as-promised'
use(chaiAsPromised)
describe('Test SmartContract `TimedCommit`', async () => {
    const aliceSigner: Signer = getDefaultSigner();
    const bobSigner: Signer = getRandomSigner();
    const alicePubKey = await aliceSigner.getPublicKey()
    const bobPubKey = await bobSigner.getPublicKey()
    const provider = getDefaultProvider()

    let secret: ByteString
    let aliceHash: ByteString
    let timedCommit: TimedCommit

    before(async () => {

        secret = toByteString('my secret', true)
        aliceHash = sha256(secret)

        timedCommit = new TimedCommit(
            aliceHash,
            PubKey(alicePubKey),
            PubKey(bobPubKey)
        )
    })

    it('should pass when Alice reveals correct secret', async () => {
        const deployPsbt = await deploy(aliceSigner, provider, timedCommit)

        const deployTx = deployPsbt.extractTransaction()

        console.log('TimedCommit deployed txid: ', deployTx.id)
        expect(deployTx.id).to.have.length(64)


        const callPsbt = await call(aliceSigner, provider, timedCommit, (contract: TimedCommit, psbt: IExtPsbt) => {
            const sig = psbt.getSig(0, {
                publicKey: alicePubKey
            })
            contract.open(secret, sig)
        },)
        const callTx = callPsbt.extractTransaction()

        console.log('TimedCommit called txid: ', callTx.id)
        expect(callTx.id).to.have.length(64)
    })

    it('should fail when Alice reveals wrong secret', async () => {

        const deployPsbt = await deploy(aliceSigner, provider, timedCommit)

        const deployTx = deployPsbt.extractTransaction()

        console.log('TimedCommit deployed txid: ', deployTx.id)
        expect(deployTx.id).to.have.length(64)

        const wrongSecret = toByteString('wrong secret', true)

        await expect(call(aliceSigner, provider, timedCommit, (contract: TimedCommit, psbt: IExtPsbt) => {
            const sig = psbt.getSig(0, {
                publicKey: alicePubKey
            })
            contract.open(wrongSecret, sig)
        })).to.be.rejected
    })

    it('should pass when Bob forfeit', async () => {
        const deployPsbt = await deploy(aliceSigner, provider, timedCommit)

        const deployTx = deployPsbt.extractTransaction()

        console.log('TimedCommit deployed txid: ', deployTx.id)
        expect(deployTx.id).to.have.length(64)

        const callPsbt = await call(aliceSigner, provider, timedCommit, (contract: TimedCommit, psbt: IExtPsbt) => {
            const aliceSig = psbt.getSig(0, {
                publicKey: alicePubKey
            })
            const bobSig = psbt.getSig(0, {
                publicKey: bobPubKey
            })
            contract.forfeit(aliceSig, bobSig)
        }, {
            unfinalize: true
        })


        const signedPsbtHex = await bobSigner.signPsbt(callPsbt.toHex(), callPsbt.psbtOptions());

        const signedPsbt = callPsbt.combine(ExtPsbt.fromHex(signedPsbtHex));

        signedPsbt.finalizeAllInputs();
        const callTx = signedPsbt.extractTransaction();
        await provider.broadcast(callTx.toHex());
        console.log('TimedCommit called txid: ', callTx.id)
        expect(callTx.id).to.have.length(64)
    })
})
