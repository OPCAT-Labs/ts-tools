import { expect, use } from 'chai'
import { TuringMachine, TuringMachineState } from '@opcat-labs/examples'
import { getDefaultProvider, getDefaultSigner } from './utils/helper'
import chaiAsPromised from 'chai-as-promised'
import { call, cloneDeep, deploy } from '@opcat-labs/scrypt-ts-opcat'
use(chaiAsPromised)

const allStates: TuringMachineState[] = [
    {
        headPos: 0n,
        tape: '01010202',
        curState: '00',
    },

    {
        headPos: 1n,
        tape: '01010202',
        curState: '00',
    },

    {
        headPos: 2n,
        tape: '01010202',
        curState: '00',
    },

    {
        headPos: 1n,
        tape: '01010302',
        curState: '01',
    },

    {
        headPos: 2n,
        tape: '01030302',
        curState: '00',
    },

    {
        headPos: 3n,
        tape: '01030302',
        curState: '00',
    },

    {
        headPos: 2n,
        tape: '01030303',
        curState: '01',
    },

    {
        headPos: 1n,
        tape: '01030303',
        curState: '01',
    },

    {
        headPos: 0n,
        tape: '01030303',
        curState: '01',
    },

    {
        headPos: 1n,
        tape: '03030303',
        curState: '00',
    },

    {
        headPos: 2n,
        tape: '03030303',
        curState: '00',
    },

    {
        headPos: 3n,
        tape: '03030303',
        curState: '00',
    },

    {
        headPos: 4n,
        tape: '0303030300',
        curState: '00',
    },

    {
        headPos: 3n,
        tape: '0303030300',
        curState: '02',
    },

    {
        headPos: 2n,
        tape: '0303030300',
        curState: '02',
    },

    {
        headPos: 1n,
        tape: '0303030300',
        curState: '02',
    },

    {
        headPos: 0n,
        tape: '0303030300',
        curState: '02',
    },

    {
        headPos: 0n,
        tape: '000303030300',
        curState: '02',
    },

    {
        headPos: 1n,
        tape: '000303030300',
        curState: '03',
    },
]

describe('Test SmartContract `TuringMachine`', () => {
    let turingMachine: TuringMachine
    const provider = getDefaultProvider()
    const signer = getDefaultSigner()

    before(async () => {
        turingMachine = new TuringMachine(allStates[0])
        turingMachine.state = cloneDeep(allStates[0])
    })

    it('should pass whole run', async () => {
        const deployPsbt = await deploy(signer, provider, turingMachine)

        const deployTx = deployPsbt.extractTransaction()

        console.log('TuringMachine deployed txid: ', deployTx.id)
        expect(deployTx.id).to.have.length(64)



        for (let step = 1; step < 19; step++) {
            const newState = cloneDeep(allStates[step])

            const currInstance = turingMachine
            const nextInstance = currInstance.next(newState)

            const callPsbt = await call(signer, provider, currInstance, (contract: TuringMachine, psbt: IExtPsbt) => {
                contract.transit()
            }, {
                contract: nextInstance,
            })
            const callTx = callPsbt.extractTransaction()

            console.log('TuringMachine called txid: ', callTx.id)

            expect(callTx.id).to.have.length(64)
            // update the current instance reference
            turingMachine = nextInstance
        }
    })
})
