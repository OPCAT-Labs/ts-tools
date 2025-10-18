import { expect, use } from 'chai'
import {
    ByteString,
    FixedArray,
    sha256,
    deploy,
    call,
    Sha256
} from '@opcat-labs/scrypt-ts-opcat'
import {
    MultiPartyHashPuzzle
} from '..'
import { getDefaultProvider, getDefaultSigner } from './utils/helper'
import chaiAsPromised from 'chai-as-promised'
use(chaiAsPromised)


function generateRandomHex(length) {
    const characters = '0123456789abcdef'
    let hex = ''

    for (let i = 0; i < length * 2; i++) {
        const randomIndex = Math.floor(Math.random() * characters.length)
        hex += characters.charAt(randomIndex)
    }

    return hex
}

describe('Test SmartContract `MultiPartyHashPuzzle`', () => {

    let contract: MultiPartyHashPuzzle
    const provider = getDefaultProvider()
    const signer = getDefaultSigner()
    let preimages: FixedArray<ByteString, typeof MultiPartyHashPuzzle.N>
    let hashes: FixedArray<Sha256, typeof MultiPartyHashPuzzle.N>

    before(async () => {
        const _preimages: Array<ByteString> = []
        const _hashes: Array<Sha256> = []
        for (let i = 0; i < MultiPartyHashPuzzle.N; i++) {
            const preimage = generateRandomHex(32)
            _preimages.push(preimage)
            _hashes.push(sha256(preimage))
        }
        preimages = _preimages as FixedArray<
            ByteString,
            typeof MultiPartyHashPuzzle.N
        >
        hashes = _hashes as FixedArray<Sha256, typeof MultiPartyHashPuzzle.N>

        contract = new MultiPartyHashPuzzle(hashes)

    })

    it('should pass the public method unit test successfully.', async () => {
        const deployPsbt = await deploy(signer, provider, contract)

        const deployTx = deployPsbt.extractTransaction();
        expect(deployTx.id).to.have.length(64)

        // Sign tx.

        // Execute actual contract call.
        const callPsbt = await call(signer, provider, contract, (contract: MultiPartyHashPuzzle, psbt: IExtPsbt) => {

            contract.unlock(preimages)
        })


        const callTx = callPsbt.extractTransaction();
        expect(callTx.id).to.have.length(64)
    })

    it('should throw with wrong sig.', async () => {
        const paymentAmt = 100

        const deployPsbt = await deploy(signer, provider, contract, paymentAmt)

        const deployTx = deployPsbt.extractTransaction();
        expect(deployTx.id).to.have.length(64)
        // Execute actual contract call.
        await expect(call(signer, provider, contract, (contract: MultiPartyHashPuzzle, psbt: IExtPsbt) => {
            const preimagesWrong = Array.from(preimages)
            preimagesWrong[0] = sha256('aabbcc')
            contract.unlock(preimagesWrong as FixedArray<ByteString, typeof MultiPartyHashPuzzle.N>)
        })).to.be.rejectedWith(/hash mismatch/)
    })

})
