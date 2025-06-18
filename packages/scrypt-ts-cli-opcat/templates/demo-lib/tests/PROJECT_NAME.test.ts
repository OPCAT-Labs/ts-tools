import { expect, use } from 'chai'
import { PROJECT_NAME, TestPROJECT_NAME } from 'package-name'
import { getDefaultProvider, getDefaultSigner } from './utils/txHelper'
import chaiAsPromised from 'chai-as-promised'
import { Covenant, deploy, call } from '@opcat-labs/scrypt-ts-opcat'
use(chaiAsPromised)

// Test library directly:
describe('Test SmartContractLib `PROJECT_NAME`', () => {
    it('static function call', () => {
        expect(PROJECT_NAME.add(1n, 2n)).to.eq(3n)
    })

    it('method call', () => {
        const myLib = new PROJECT_NAME(5n)
        expect(myLib.diff(2n)).to.eq(3n)
    })
})

// Test library from a smart contract.
describe('Test SmartContractLib `Lib`', () => {
    let covenant: Covenant

    before(async () => {
        covenant = Covenant.createCovenant(new TestPROJECT_NAME())
    })

    it('should pass integration test successfully.', async () => {
        const provider = getDefaultProvider()
        const signer = getDefaultSigner()

        const deployPsbt = await deploy(signer, provider, covenant)

        expect(deployPsbt.extractTransaction().getId()).to.have.length(64)

        const callPsbt = await call(signer, provider, covenant, {
            invokeMethod: (contract: TestPROJECT_NAME) => {
                contract.unlock1(3n)
            },
        })

        expect(callPsbt.extractTransaction().getId()).to.have.length(64)
    })

    it('should pass integration test successfully.', async () => {
        const provider = getDefaultProvider()
        const signer = getDefaultSigner()

        const deployPsbt = await deploy(signer, provider, covenant)

        expect(deployPsbt.extractTransaction().getId()).to.have.length(64)

        const callPsbt = await call(signer, provider, covenant, {
            invokeMethod: (contract: TestPROJECT_NAME) => {
                contract.unlock2(3n)
            },
        })

        expect(callPsbt.extractTransaction().getId()).to.have.length(64)
    })
})
