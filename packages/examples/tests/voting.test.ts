import { expect } from 'chai'
import { CandidateName, Voting, Candidate } from '..'
import { getDefaultProvider, getDefaultSigner, getRandomInt } from './utils/helper'
import { call, cloneDeep, deploy, IExtPsbt, FixedArray, toByteString } from '@opcat-labs/scrypt-ts-opcat'

const N = 10
describe('Test SmartContract `Voting`', () => {

    let voting: Voting
    const provider = getDefaultProvider()
    const signer = getDefaultSigner()

    const candidateNames: FixedArray<CandidateName, typeof N> = [
        toByteString('candidate1', true),
        toByteString('candidate2', true),
        toByteString('candidate3', true),
        toByteString('candidate4', true),
        toByteString('candidate5', true),
        toByteString('candidate6', true),
        toByteString('candidate7', true),
        toByteString('candidate8', true),
        toByteString('candidate9', true),
        toByteString('candidate10', true),
    ]

    before(() => {

        voting = new Voting()
        const candidates: FixedArray<Candidate, typeof N> = [
            {
                name: candidateNames[0],
                votesReceived: 0n
            },
            {
                name: candidateNames[1],
                votesReceived: 0n
            },
            {
                name: candidateNames[2],
                votesReceived: 0n
            },
            {
                name: candidateNames[3],
                votesReceived: 0n
            },
            {
                name: candidateNames[4],
                votesReceived: 0n
            },
            {
                name: candidateNames[5],
                votesReceived: 0n
            },
            {
                name: candidateNames[6],
                votesReceived: 0n
            },
            {
                name: candidateNames[7],
                votesReceived: 0n
            },
            {
                name: candidateNames[8],
                votesReceived: 0n
            },
            {
                name: candidateNames[9],
                votesReceived: 0n
            },
        ]
        voting.state = {
            candidates: candidates
        }

    })


    it('should pass the public method unit test successfully.', async () => {

        const deployPsbt = await deploy(signer, provider, voting)

        const deployTx = deployPsbt.extractTransaction()

        console.log('Voting deployed txid: ', deployTx.id)
        expect(deployTx.id).to.have.length(64)



        // set current instance to be the deployed one
        let currentInstance = voting

        // call the method of current instance to apply the updates on chain
        for (let i = 0; i < 10; ++i) {
            // create the next instance from the current
            const nextInstance = currentInstance.next({
                candidates: cloneDeep(currentInstance.state.candidates),
            })

            const candidate = candidateNames[getRandomInt(0, N)]
            // update state
            nextInstance.increaseVotesReceived(candidate)


            const callPsbt = await call(signer, provider, currentInstance, (contract: Voting, psbt: IExtPsbt) => {
                contract.vote(candidate)
            }, {
                contract: nextInstance,
            })

            const callTx = callPsbt.extractTransaction()
            console.log('Voting called txid: ', callTx.id)

            expect(callTx.id).to.have.length(64)


            // update the current instance reference
            currentInstance = nextInstance
        }
    })
})
