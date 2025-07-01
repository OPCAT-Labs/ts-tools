import { expect, use } from 'chai'
import {
    sha256,
    toByteString,
    deploy,
    call,
} from '@opcat-labs/scrypt-ts-opcat'
import { PROJECT_NAME } from 'package-name'
import { getDefaultSigner, getDefaultProvider } from './utils/txHelper'
import chaiAsPromised from 'chai-as-promised'
use(chaiAsPromised)

describe('Test SmartContract `PROJECT_NAME`', () => {
    let contract: PROJECT_NAME

    before(async () => {
        contract = new PROJECT_NAME(
            sha256(toByteString('hello world', true))
        )
    })

    it('should pass the public method unit test successfully.', async () => {
        const provider = getDefaultProvider()
        const signer = getDefaultSigner()

        const deployPsbt = await deploy(signer, provider, contract)

        expect(deployPsbt.extractTransaction().id).to.have.length(64)

        const callPsbt = await call(
            signer, 
            provider, 
            contract, 
            (contract: PROJECT_NAME) => {
                contract.unlock(toByteString('hello world', true))
            }
        )

        expect(callPsbt.extractTransaction().id).to.have.length(64)
    })
})
