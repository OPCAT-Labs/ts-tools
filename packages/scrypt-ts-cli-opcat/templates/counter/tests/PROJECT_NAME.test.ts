import { expect, use } from 'chai'
import { deploy, call, StatefulCovenant } from '@opcat-labs/scrypt-ts-opcat'
import { PROJECT_NAME, PROJECT_NAMEState } from 'package-name'
import { getDefaultSigner, getDefaultProvider } from './utils/txHelper'
import chaiAsPromised from 'chai-as-promised'
use(chaiAsPromised)

describe('Test SmartContract `PROJECT_NAME`', () => {
    let covenant: StatefulCovenant<PROJECT_NAMEState>

    before(async () => {
        const contract = new PROJECT_NAME()
        contract.state = { count: -3n }

        covenant = StatefulCovenant.createCovenant(contract)
    })

    it('should pass the public method unit test successfully.', async () => {
        const provider = getDefaultProvider()
        const signer = getDefaultSigner()

        const deployPsbt = await deploy(signer, provider, covenant)

        expect(deployPsbt.extractTransaction().getId()).to.have.length(64)

        for (let i = 0; i < 10; i++) {
            const newCovenant = covenant.next({
                count: covenant.state.count + 1n,
            })

            const callPsbt = await call(
                signer,
                provider,
                covenant,
                {
                    invokeMethod: (contract: PROJECT_NAME) => {
                        contract.increase()
                    },
                },
                {
                    covenant: newCovenant,
                    satoshis: 330,
                }
            )

            expect(callPsbt.extractTransaction().getId()).to.have.length(64)

            covenant = newCovenant
        }
    })
})
