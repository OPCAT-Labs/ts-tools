import { expect, use } from 'chai'
import {
    sha256,
    toByteString,
    deploy,
    call,
    IExtPsbt,
} from '@opcat-labs/scrypt-ts'
import { Examples } from '@opcat-labs/examples'
import { getDefaultSigner, getDefaultProvider } from './utils/helper'
import chaiAsPromised from 'chai-as-promised'
use(chaiAsPromised)

describe('Test SmartContract `Examples`', () => {
    let contract: Examples

    before(async () => {
        contract = new Examples(
            sha256(toByteString('hello world', true))
        )
    })

    it('should pass the public method unit test successfully.', async () => {
        const provider = getDefaultProvider()
        const signer = getDefaultSigner()

        const deployPsbt = await deploy(signer, provider, contract)

        expect(deployPsbt.extractTransaction().id).to.have.length(64)

        const callPsbt = await call(signer, provider, contract, (contract: Examples, psbt: IExtPsbt) => {
            contract.unlock(toByteString('hello world', true))
        })

        expect(callPsbt.extractTransaction().id).to.have.length(64)
    })
})
