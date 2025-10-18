import { expect, use } from 'chai'
import {
    deploy,
    call,
    IExtPsbt,
} from '@opcat-labs/scrypt-ts-opcat'
import { ArraysTest } from '..'
import { getDefaultSigner, getDefaultProvider } from './utils/helper'
import chaiAsPromised from 'chai-as-promised'
use(chaiAsPromised)

describe('Test SmartContract `ArraysTest`', () => {
    let contract: ArraysTest

    before(async () => {
        contract = new ArraysTest()
    })

    it('should pass the public method unit test successfully.', async () => {
        const provider = getDefaultProvider()
        const signer = getDefaultSigner()

        const deployPsbt = await deploy(signer, provider, contract)

        expect(deployPsbt.extractTransaction().id).to.have.length(64)

        const callPsbt = await call(signer, provider, contract, (contract: ArraysTest, psbt: IExtPsbt) => {
            contract.test(1n)
        })

        expect(callPsbt.extractTransaction().id).to.have.length(64)
    })
})
