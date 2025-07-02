import { expect, use } from 'chai'
import {
    deploy,
    call,
    IExtPsbt,
} from '@opcat-labs/scrypt-ts-opcat'
import { Ackermann } from '@opcat-labs/examples'
import { getDefaultSigner, getDefaultProvider } from './utils/helper'
import chaiAsPromised from 'chai-as-promised'
use(chaiAsPromised)

describe('Test SmartContract `Ackermann`', () => {
    let contract: Ackermann

    before(async () => {
        contract = new Ackermann(2n, 1n)
    })

    it('should pass the public method unit test successfully.', async () => {
        const provider = getDefaultProvider()
        const signer = getDefaultSigner()

        const deployPsbt = await deploy(signer, provider, contract)

        expect(deployPsbt.extractTransaction().id).to.have.length(64)

        const callPsbt = await call(signer, provider, contract, (contract: Ackermann, psbt: IExtPsbt) => {
            contract.unlock(5n)
        })

        expect(callPsbt.extractTransaction().id).to.have.length(64)
    })
})
