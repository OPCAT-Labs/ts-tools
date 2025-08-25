import { expect, use } from 'chai'
import { deploy, call } from '@opcat-labs/scrypt-ts'
import { PROJECT_NAME, PROJECT_NAMEState } from 'package-name'
import { getDefaultSigner, getDefaultProvider } from './utils/txHelper'
import chaiAsPromised from 'chai-as-promised'
use(chaiAsPromised)

describe('Test SmartContract `PROJECT_NAME`', () => {
    let contract: PROJECT_NAMEState

    before(async () => {
        contract = new PROJECT_NAME()
        contract.state = { count: -3n }
    })

    it('should pass the public method unit test successfully.', async () => {
        const provider = getDefaultProvider()
        const signer = getDefaultSigner()

        const deployPsbt = await deploy(signer, provider, contract, 1)

        expect(deployPsbt.extractTransaction().id).to.have.length(64)

        for (let i = 0; i < 10; i++) {
            const newContract = contract.next({
                count: contract.state.count + 1n,
            })

            const callPsbt = await call(
                signer,
                provider,
                contract,
                
                (contract: PROJECT_NAME) => {
                    contract.increase()
                },
                {
                    contract: newContract,
                    satoshis: 1,
                }
            )

            expect(callPsbt.extractTransaction().id).to.have.length(64)

            contract = newContract
        }
    })
})
