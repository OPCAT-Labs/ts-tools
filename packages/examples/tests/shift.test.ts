import { expect, use } from 'chai'
import {
    deploy,
    call,
    IExtPsbt,
} from '@opcat-labs/scrypt-ts-opcat'
import { ShiftTest } from '..'
import { getDefaultSigner, getDefaultProvider } from './utils/helper'
import chaiAsPromised from 'chai-as-promised'
use(chaiAsPromised)

describe('Test SmartContract `ShiftTest`', () => {
    let contract: ShiftTest

    before(async () => {
        contract = new ShiftTest()
    })

    it('pow2: should pass', async () => {
        const provider = getDefaultProvider()
        const signer = getDefaultSigner()

        const deployPsbt = await deploy(signer, provider, contract)

        expect(deployPsbt.extractTransaction().id).to.have.length(64)

        const callPsbt = await call(signer, provider, contract, (contract: ShiftTest, psbt: IExtPsbt) => {
            contract.pow2(3n, 8n)
        })

        expect(callPsbt.extractTransaction().id).to.have.length(64)
    })

    it('left: should pass', async () => {
        const provider = getDefaultProvider()
        const signer = getDefaultSigner()

        const deployPsbt = await deploy(signer, provider, contract)

        expect(deployPsbt.extractTransaction().id).to.have.length(64)

        const callPsbt = await call(signer, provider, contract, (contract: ShiftTest, psbt: IExtPsbt) => {
            contract.left(2n, 2n, 8n)
        })

        expect(callPsbt.extractTransaction().id).to.have.length(64)
    })

    it('right: should pass', async () => {
        const provider = getDefaultProvider()
        const signer = getDefaultSigner()

        const deployPsbt = await deploy(signer, provider, contract)

        expect(deployPsbt.extractTransaction().id).to.have.length(64)

        const callPsbt = await call(signer, provider, contract, (contract: ShiftTest, psbt: IExtPsbt) => {
            contract.right(8n, 2n, 2n)
        })

        expect(callPsbt.extractTransaction().id).to.have.length(64)
    })
})
