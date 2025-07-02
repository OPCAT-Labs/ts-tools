import { expect, use } from 'chai'
import { Rule110 } from '@opcat-labs/examples'
import { getDefaultProvider, getDefaultSigner } from './utils/helper'
import chaiAsPromised from 'chai-as-promised'
import { call, deploy, IExtPsbt, toByteString } from '@opcat-labs/scrypt-ts-opcat'
use(chaiAsPromised)

describe('Test SmartContract `Rule110`', () => {
    let contract: Rule110
    const provider = getDefaultProvider()
    const signer = getDefaultSigner()
    before(async () => {
        contract = new Rule110()

    })

    it('it should pass the public method play successfully ', async () => {
        contract.state = {
            board: toByteString('0101000100')
        }
        const deployPsbt = await deploy(signer, provider, contract)

        const deployTx = deployPsbt.extractTransaction();
        expect(deployTx.id).to.have.length(64)

        for (let i = 0; i < 5; i++) {
            // Execute actual contract call.

            const newContract = contract.next({ board: contract.computeNewBoard(contract.state.board) })

            const callPsbt = await call(signer, provider, contract, (contract: Rule110, psbt: IExtPsbt) => {
                contract.play()
            }, {
                contract: newContract,
            })

            const callTx = callPsbt.extractTransaction();
            expect(callTx.id).to.have.length(64)
            contract = newContract
        }


    })

})
