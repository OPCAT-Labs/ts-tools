

import { TestHashedMapOperator } from './src/contracts/testHashedMapOperator.js'
import { TestHashedMapMain } from './src/contracts/testHashedMapMain.js'
import { DummyStruct, TestHashedMapMainState, TestHashedMapStateLib } from './src/contracts/testHashedMapStateLib.js'
import { HashedMap, HashedMapAbiUtil, PrivateKey, sha256, deploy, DefaultSigner, MempoolProvider, UTXO, ExtPsbt, Sha256, ByteString, cloneDeep, Int32, bvmVerify } from '@opcat-labs/scrypt-ts-opcat'
import * as fs from 'fs'
import * as path from 'path'

import * as testHashedMapOperator from './artifacts/contracts/testHashedMapOperator.json'
import * as testHashedMapMain from './artifacts/contracts/testHashedMapMain.json'
import * as testHashedMapStateLib from './artifacts/contracts/testHashedMapStateLib.json'

TestHashedMapOperator.loadArtifact(testHashedMapOperator)
TestHashedMapMain.loadArtifact(testHashedMapMain)
TestHashedMapStateLib.loadArtifact(testHashedMapStateLib)

const privateKey = PrivateKey.fromWIF('cQfb2vnBvKryZjG7MuWwDoeMpvHBNAqaNyJH3cNxdHxnHWd6Kv7f')
const signer = new DefaultSigner(privateKey)
const provider = new MempoolProvider('opcat-testnet')

runTestCase({
    map1: new HashedMap<Int32, ByteString, 2>([]),
    map2: new HashedMap<ByteString, DummyStruct, 1>([]),
}, -1)

async function runTestCase(
    initialMainState: TestHashedMapMainState,
    waitBlock: number,
) {
    console.log('address', await signer.getAddress())
    console.log('initialMainState', TestHashedMapMain.serializeState(initialMainState))
    const configs = getHashedMapConfig(initialMainState)
    const date = new Date().toISOString()
    const fileName = `testHashedMap_${date.replaceAll(':', '_')}.json`
    fs.writeFileSync(path.resolve(__dirname, 'tmp', fileName), JSON.stringify(configs, null, 2))
    const deployRes = await deployMain(initialMainState)
    console.log('deploy main txid: ', deployRes.txid)
    let utxoData = {
        mainContractInput: deployRes.mainContract,
        feeUtxo: deployRes.changeUtxo,
    }
    utxoData = await testChangeMap1(utxoData.feeUtxo, utxoData.mainContractInput, waitBlock)
    utxoData = await testChangeMap2(utxoData.feeUtxo, utxoData.mainContractInput, waitBlock)
    utxoData = await testChangeBoth(utxoData.feeUtxo, utxoData.mainContractInput, waitBlock)
    console.log('state', TestHashedMapMain.serializeState(utxoData.mainContractInput.state))
    console.log('map1', utxoData.mainContractInput.state.map1.serializedEntries())
    console.log('map2', utxoData.mainContractInput.state.map2.serializedEntries())
}

function getHashedMapConfig(
    initMainState: TestHashedMapMainState,
) {

    const mainContract = new TestHashedMapMain()
    const mainScriptHash = sha256(mainContract.lockingScript.toHex())
    const operatorContract = new TestHashedMapOperator(mainScriptHash)
    let configs = [
        HashedMapAbiUtil.exportHashedMapTrackerConfig(
            new TestHashedMapMain(),
            'map1',
            [initMainState],
            [
                {
                    contract: mainContract,
                    methodName: 'changeMap1',
                    methodParamName: 'this.state',
                },
                {
                    contract: mainContract,
                    methodName: 'changeBoth',
                    methodParamName: 'this.state',
                },
                {
                    contract: operatorContract,
                    methodName: 'changeMap1',
                    methodParamName: 'mainState',
                },
                {
                    contract: operatorContract,
                    methodName: 'changeBoth',
                    methodParamName: 'mainState',
                }
            ]
        ),
        HashedMapAbiUtil.exportHashedMapTrackerConfig(
            new TestHashedMapMain(),
            'map2',
            [initMainState],
            [
                {
                    contract: mainContract,
                    methodName: 'changeMap2',
                    methodParamName: 'this.state',
                },
                {
                    contract: mainContract,
                    methodName: 'changeBoth',
                    methodParamName: 'this.state',
                },
                {
                    contract: operatorContract,
                    methodName: 'changeMap2',
                    methodParamName: 'mainState',
                },
                {
                    contract: operatorContract,
                    methodName: 'changeBoth',
                    methodParamName: 'mainState',
                }
            ]
        )
    ]
    return configs;
}

async function deployMain(
    initMainState: TestHashedMapMainState,
) {
    const mainContract = new TestHashedMapMain()
    mainContract.state = initMainState
    const psbt = await deploy(signer, provider, mainContract)
    mainContract.bindToUtxo(psbt.getUtxo(0))
    mainContract.state = initMainState
    return {
        psbt,
        txid: psbt.extractTransaction().id,
        mainUtxo: psbt.getUtxo(0),
        changeUtxo: psbt.getChangeUTXO()!,
        mainContract,
    }
}

async function deployOperator(
    mainScriptHash: Sha256,
    feeUtxo: UTXO,
) {
    const operatorContract = new TestHashedMapOperator(mainScriptHash)
    const psbt = new ExtPsbt({network: await provider.getNetwork()})
    psbt.spendUTXO(feeUtxo)
    psbt.addContractOutput(operatorContract, 1)
    psbt.change(await signer.getAddress(), await provider.getFeeRate())
    psbt.seal()
    const signedPsbtHex = await signer.signPsbt(psbt.toHex(), psbt.psbtOptions())
    psbt.combine(ExtPsbt.fromHex(signedPsbtHex)).finalizeAllInputs()
    const deployTx = psbt.extractTransaction()
    await provider.broadcast(deployTx.toHex())
    return {
        psbt,
        txid: psbt.extractTransaction().id,
        operatorUtxo: psbt.getUtxo(0),
        changeUtxo: psbt.getChangeUTXO()!,
        operatorContract,
    }
}

function addUpdateMap1Inputs(
    psbt: ExtPsbt,
    changeMap1: {
        key1: bigint,
        value1: ByteString,
        key2: bigint,
        value2: ByteString,
    },
    useMainChanger: boolean,
    useOperatorChanger: boolean,
    withOperatorJustUnlock: boolean,
    mainContractInput: TestHashedMapMain,
    operatorContractInput?: TestHashedMapOperator,
) {
    psbt.addContractInput(mainContractInput, (contract) => {
        if (useMainChanger) {
            contract.changeMap1(changeMap1.key1, changeMap1.value1, changeMap1.key2, changeMap1.value2)
        } else {
            contract.justUnlock()
        }
    })

    if (useOperatorChanger || withOperatorJustUnlock) {
        psbt.addContractInput(operatorContractInput!, (contract) => {
            if (useOperatorChanger) {
                contract.changeMap1(mainContractInput.state, changeMap1.key1, changeMap1.value1, changeMap1.key2, changeMap1.value2)
            } else {
                contract.justUnlock()
            }
        })
    }
}

function addUpdateMap2Inputs(
    psbt: ExtPsbt,
    changeMap2: {
        key: ByteString,
        value: DummyStruct,
    },
    useMainChanger: boolean,
    useOperatorChanger: boolean,
    withOperatorJustUnlock: boolean,
    mainContractInput: TestHashedMapMain,
    operatorContractInput?: TestHashedMapOperator,
) {
    psbt.addContractInput(mainContractInput, (contract) => {
        if (useMainChanger) {
            contract.changeMap2(changeMap2.key, changeMap2.value)
        } else {
            contract.justUnlock()
        }
    })

    if (useOperatorChanger || withOperatorJustUnlock) {
        psbt.addContractInput(operatorContractInput!, (contract) => {
            if (useOperatorChanger) {
                contract.changeMap2(mainContractInput.state, changeMap2.key, changeMap2.value)
            } else {
                contract.justUnlock()
            }
        })
    }
}

function addUpdateBothInputs(
    psbt: ExtPsbt,
    
    change: {
        changeMap1: {
            key1: bigint,
            value1: ByteString,
            key2: bigint,
            value2: ByteString,
        },
        changeMap2: {
            key: ByteString,
            value: DummyStruct,
        },
    },
    useMainChanger: boolean,
    useOperatorChanger: boolean,
    withOperatorJustUnlock: boolean,
    mainContractInput: TestHashedMapMain,
    operatorContractInput?: TestHashedMapOperator,
) {
    psbt.addContractInput(mainContractInput, (contract) => {
        if (useMainChanger) {
            contract.changeBoth(change.changeMap1.key1, change.changeMap1.value1, change.changeMap1.key2, change.changeMap1.value2, change.changeMap2.key, change.changeMap2.value)
        } else {
            contract.justUnlock()
        }
    })
    if (useOperatorChanger || withOperatorJustUnlock) {
        psbt.addContractInput(operatorContractInput!, (contract) => {
            if (useOperatorChanger) {
                contract.changeBoth(mainContractInput.state, change.changeMap1.key1, change.changeMap1.value1, change.changeMap1.key2, change.changeMap1.value2, change.changeMap2.key, change.changeMap2.value)
            } else {
                contract.justUnlock()
            }
        })
    }
}

function addUpdateOutputs(
    psbt: ExtPsbt,
    mainContractInput: TestHashedMapMain,
    change: {
        
        changeMap1?: {
            key1: bigint,
            value1: ByteString,
            key2: bigint,
            value2: ByteString,
        },
        changeMap2?: {
            key: ByteString,
            value: DummyStruct,
        },
    },
    changeAddress: string,
    feeRate: number,
) {
    const state = cloneDeep(mainContractInput.state)
    if (change.changeMap1) {
        state.map1.set(change.changeMap1.key1, change.changeMap1.value1)
        state.map1.set(change.changeMap1.key2, change.changeMap1.value2)
    }
    if (change.changeMap2) {
        state.map2.set(change.changeMap2.key, change.changeMap2.value)
    }
    const mainContract = new TestHashedMapMain()
    mainContract.state = state
    psbt.addContractOutput(mainContract, 1)
    psbt.change(changeAddress, feeRate)

    return {
        psbt,
        mainContract
    }
}


async function testChangeMap1(
    feeUtxo: UTXO,
    mainContractInput: TestHashedMapMain,
    waitBlock: number,
) {
    let lastTxid = ''
    const mainScriptHash = mainContractInput.lockingScriptHash
    {
        // use main change, do not add operator input
        const deployRes = await deployOperator(mainScriptHash, feeUtxo)
        feeUtxo = deployRes.changeUtxo;
        console.log('use main change, do not add operator input')
        console.log('deploy operator txid: ', deployRes.txid)

        const psbt = new ExtPsbt({network: await provider.getNetwork()})
        const changeMap1 = {
            key1: 1n,
            value1: '0101',
            key2: 2n,
            value2: '0202',
        }
        addUpdateMap1Inputs(psbt, changeMap1, true, false, false, mainContractInput, deployRes.operatorContract)
        psbt.spendUTXO(feeUtxo)
        mainContractInput = addUpdateOutputs(
            psbt,
            mainContractInput,
            {
                changeMap1,
            },
            await signer.getAddress(),
            await provider.getFeeRate()
        ).mainContract
        psbt.seal()
        const signedPsbtHex = await signer.signPsbt(psbt.toHex(), psbt.psbtOptions())
        psbt.combine(ExtPsbt.fromHex(signedPsbtHex)).finalizeAllInputs()
        const callTx = psbt.extractTransaction()
        verifyBvm(psbt)
        await provider.broadcast(callTx.toHex())
        console.log('use main change, do not add operator input, txid: ', callTx.id)
        lastTxid = callTx.id
        feeUtxo = psbt.getChangeUTXO()!
    }
    await waitTxidConfig(lastTxid, waitBlock)
    {
        // use main change, use operator justUnlock
        const deployRes = await deployOperator(mainScriptHash, feeUtxo)
        feeUtxo = deployRes.changeUtxo;
        console.log('use main change, use operator justUnlock')
        console.log('deploy operator txid: ', deployRes.txid)
        const psbt = new ExtPsbt({network: await provider.getNetwork()})
        const changeMap1 = {
            key1: 3n,
            value1: '0303',
            key2: 4n,
            value2: '0404',
        }
        addUpdateMap1Inputs(psbt, changeMap1, true, true, true, mainContractInput, deployRes.operatorContract)
        psbt.spendUTXO(feeUtxo)
        mainContractInput = addUpdateOutputs(
            psbt,
            mainContractInput,
            {
                changeMap1,
            },
            await signer.getAddress(),
            await provider.getFeeRate()
        ).mainContract
        psbt.seal()
        const signedPsbtHex = await signer.signPsbt(psbt.toHex(), psbt.psbtOptions())
        psbt.combine(ExtPsbt.fromHex(signedPsbtHex)).finalizeAllInputs()
        const callTx = psbt.extractTransaction()
        verifyBvm(psbt)
        await provider.broadcast(callTx.toHex())
        console.log('use main change, use operator justUnlock, txid: ', callTx.id)
        lastTxid = callTx.id
        feeUtxo = psbt.getChangeUTXO()!
    }
    await waitTxidConfig(lastTxid, waitBlock)
    {
        // use main justUnlock, use operator change
        const deployRes = await deployOperator(mainScriptHash, feeUtxo)
        feeUtxo = deployRes.changeUtxo;
        console.log('use main justUnlock, use operator change')
        console.log('deploy operator txid: ', deployRes.txid)
        const psbt = new ExtPsbt({network: await provider.getNetwork()})
        const changeMap1 = {
            key1: 5n,
            value1: '0505',
            key2: 6n,
            value2: '0606',
        }
        addUpdateMap1Inputs(psbt, changeMap1, false, true, false, mainContractInput, deployRes.operatorContract)
        psbt.spendUTXO(feeUtxo)
        mainContractInput = addUpdateOutputs(
            psbt,
            mainContractInput,
            {
                changeMap1,
            },
            await signer.getAddress(),
            await provider.getFeeRate()
        ).mainContract
        psbt.seal()
        const signedPsbtHex = await signer.signPsbt(psbt.toHex(), psbt.psbtOptions())
        psbt.combine(ExtPsbt.fromHex(signedPsbtHex)).finalizeAllInputs()
        const callTx = psbt.extractTransaction()
        verifyBvm(psbt)
        await provider.broadcast(callTx.toHex())
        console.log('use main justUnlock, use operator change, txid: ', callTx.id)
        lastTxid = callTx.id
        feeUtxo = psbt.getChangeUTXO()!
    }
    await waitTxidConfig(lastTxid, waitBlock)
    return {
        mainContractInput,
        feeUtxo
    }
}

async function testChangeMap2(
    feeUtxo: UTXO,
    mainContractInput: TestHashedMapMain,
    waitBlock: number,
) {
    let lastTxid = ''
    const mainScriptHash = mainContractInput.lockingScriptHash
    {
        // use main change, do not add operator input
        const deployRes = await deployOperator(mainScriptHash, feeUtxo)
        feeUtxo = deployRes.changeUtxo;
        console.log('use main change, do not add operator input')
        console.log('deploy operator txid: ', deployRes.txid)
        const psbt = new ExtPsbt({network: await provider.getNetwork()})
        const changeMap2 = {
            key: '01',
            value: {
                num: 11n,
                str: '0202',
            },
        }
        addUpdateMap2Inputs(psbt, changeMap2, true, false, false, mainContractInput, deployRes.operatorContract)
        psbt.spendUTXO(feeUtxo)
        mainContractInput = addUpdateOutputs(
            psbt,
            mainContractInput,
            {
                changeMap2,
            },
            await signer.getAddress(),
            await provider.getFeeRate()
        ).mainContract
        psbt.seal()
        const signedPsbtHex = await signer.signPsbt(psbt.toHex(), psbt.psbtOptions())
        psbt.combine(ExtPsbt.fromHex(signedPsbtHex)).finalizeAllInputs()
        const callTx = psbt.extractTransaction()
        verifyBvm(psbt)
        await provider.broadcast(callTx.toHex())
        console.log('use main change, do not add operator input, txid: ', callTx.id)
        lastTxid = callTx.id
        feeUtxo = psbt.getChangeUTXO()!
    }
    await waitTxidConfig(lastTxid, waitBlock)
    {
        // use main change, use operator justUnlock
        const deployRes = await deployOperator(mainScriptHash, feeUtxo)
        feeUtxo = deployRes.changeUtxo;
        console.log('use main change, use operator justUnlock')
        console.log('deploy operator txid: ', deployRes.txid)
        const psbt = new ExtPsbt({network: await provider.getNetwork()})
        const changeMap2 = {
            key: '02',
            value: {
                num: 22n,
                str: '0303',
            },
        }
        addUpdateMap2Inputs(psbt, changeMap2, true, true, true, mainContractInput, deployRes.operatorContract)
        psbt.spendUTXO(feeUtxo)
        mainContractInput = addUpdateOutputs(
            psbt,
            mainContractInput,
            {
                changeMap2,
            },
            await signer.getAddress(),
            await provider.getFeeRate()
        ).mainContract
        psbt.seal()
        const signedPsbtHex = await signer.signPsbt(psbt.toHex(), psbt.psbtOptions())
        psbt.combine(ExtPsbt.fromHex(signedPsbtHex)).finalizeAllInputs()
        const callTx = psbt.extractTransaction()
        verifyBvm(psbt)
        await provider.broadcast(callTx.toHex())
        console.log('use main change, use operator justUnlock, txid: ', callTx.id)
        lastTxid = callTx.id
        feeUtxo = psbt.getChangeUTXO()!
    }
    await waitTxidConfig(lastTxid, waitBlock)
    {
        // use main justUnlock, use operator change
        const deployRes = await deployOperator(mainScriptHash, feeUtxo)
        feeUtxo = deployRes.changeUtxo;
        console.log('use main justUnlock, use operator change')
        console.log('deploy operator txid: ', deployRes.txid)
        const psbt = new ExtPsbt({network: await provider.getNetwork()})
        const changeMap2 = {
            key: '03',
            value: {
                num: 33n,
                str: '0404',
            },
        }
        addUpdateMap2Inputs(psbt, changeMap2, false, true, false, mainContractInput, deployRes.operatorContract)
        psbt.spendUTXO(feeUtxo)
        mainContractInput = addUpdateOutputs(
            psbt,
            mainContractInput,
            {
                changeMap2,
            },
            await signer.getAddress(),
            await provider.getFeeRate()
        ).mainContract
        psbt.seal()
        const signedPsbtHex = await signer.signPsbt(psbt.toHex(), psbt.psbtOptions())
        psbt.combine(ExtPsbt.fromHex(signedPsbtHex)).finalizeAllInputs()
        const callTx = psbt.extractTransaction()
        verifyBvm(psbt)
        await provider.broadcast(callTx.toHex())
        console.log('use main justUnlock, use operator change, txid: ', callTx.id)
        lastTxid = callTx.id
        feeUtxo = psbt.getChangeUTXO()!
    }
    await waitTxidConfig(lastTxid, waitBlock)
    return {
        mainContractInput,
        feeUtxo
    }
}

async function testChangeBoth(
    feeUtxo: UTXO,
    mainContractInput: TestHashedMapMain,
    waitBlock: number,
) {
    let lastTxid = ''
    const mainScriptHash = mainContractInput.lockingScriptHash
    {
        // use main change, do not add operator input
        const deployRes = await deployOperator(mainScriptHash, feeUtxo)
        feeUtxo = deployRes.changeUtxo;
        console.log('use main change, do not add operator input')
        console.log('deploy operator txid: ', deployRes.txid)
        const psbt = new ExtPsbt({network: await provider.getNetwork()})
        const changeBoth = {
            changeMap1: {
                key1: 8n,
                value1: '0808',
                key2: 9n,
                value2: '0909',
            },
            changeMap2: {
                key: '10',
                value: {
                    num: 1010n,
                    str: '1111',
                },
            },
        }
        addUpdateBothInputs(psbt, changeBoth, true, false, false, mainContractInput, deployRes.operatorContract)
        psbt.spendUTXO(feeUtxo)
        mainContractInput = addUpdateOutputs(
            psbt,
            mainContractInput,
            changeBoth,
            await signer.getAddress(),
            await provider.getFeeRate()
        ).mainContract
        psbt.seal()
        const signedPsbtHex = await signer.signPsbt(psbt.toHex(), psbt.psbtOptions())
        psbt.combine(ExtPsbt.fromHex(signedPsbtHex)).finalizeAllInputs()
        const callTx = psbt.extractTransaction()
        verifyBvm(psbt)
        await provider.broadcast(callTx.toHex())
        console.log('use main change, do not add operator input, txid: ', callTx.id)
        lastTxid = callTx.id
        feeUtxo = psbt.getChangeUTXO()!
    }
    await waitTxidConfig(lastTxid, waitBlock)
    {
        // use main change, use operator justUnlock
        const deployRes = await deployOperator(mainScriptHash, feeUtxo)
        feeUtxo = deployRes.changeUtxo;
        console.log('use main change, use operator justUnlock')
        console.log('deploy operator txid: ', deployRes.txid)
        const psbt = new ExtPsbt({network: await provider.getNetwork()})
        const changeBoth = {
            changeMap1: {
                key1: 11n,
                value1: '1111',
                key2: 12n,
                value2: '1212',
            },
            changeMap2: {
                key: '13',
                value: {
                    num: 1313n,
                    str: '1414',
                },
            },
        }
        addUpdateBothInputs(psbt, changeBoth, true, true, true, mainContractInput, deployRes.operatorContract)
        psbt.spendUTXO(feeUtxo)
        mainContractInput = addUpdateOutputs(
            psbt,
            mainContractInput,
            changeBoth,
            await signer.getAddress(),
            await provider.getFeeRate()
        ).mainContract
        psbt.seal()
        const signedPsbtHex = await signer.signPsbt(psbt.toHex(), psbt.psbtOptions())
        psbt.combine(ExtPsbt.fromHex(signedPsbtHex)).finalizeAllInputs()
        const callTx = psbt.extractTransaction()
        verifyBvm(psbt)
        await provider.broadcast(callTx.toHex())
        console.log('use main change, use operator justUnlock, txid: ', callTx.id)
        lastTxid = callTx.id
        feeUtxo = psbt.getChangeUTXO()!
    }
    await waitTxidConfig(lastTxid, waitBlock)
    {
        // use main justUnlock, use operator change
        const deployRes = await deployOperator(mainScriptHash, feeUtxo)
        feeUtxo = deployRes.changeUtxo;
        console.log('use main justUnlock, use operator change')
        console.log('deploy operator txid: ', deployRes.txid)
        const psbt = new ExtPsbt({network: await provider.getNetwork()})
        const changeBoth = {
            changeMap1: {
                key1: 14n,
                value1: '1414',
                key2: 15n,
                value2: '1515',
            },
            changeMap2: {
                key: '16',
                value: {
                    num: 1616n,
                    str: '1717',
                },
            },
        }
        addUpdateBothInputs(psbt, changeBoth, false, true, false, mainContractInput, deployRes.operatorContract)
        psbt.spendUTXO(feeUtxo)
        mainContractInput = addUpdateOutputs(
            psbt,
            mainContractInput,
            changeBoth,
            await signer.getAddress(),
            await provider.getFeeRate()
        ).mainContract
        psbt.seal()
        const signedPsbtHex = await signer.signPsbt(psbt.toHex(), psbt.psbtOptions())
        psbt.combine(ExtPsbt.fromHex(signedPsbtHex)).finalizeAllInputs()
        const callTx = psbt.extractTransaction()
        verifyBvm(psbt)
        await provider.broadcast(callTx.toHex())
        console.log('use main justUnlock, use operator change, txid: ', callTx.id)
        lastTxid = callTx.id
        feeUtxo = psbt.getChangeUTXO()!
    }
    await waitTxidConfig(lastTxid, waitBlock)
    return {
        mainContractInput,
        feeUtxo
    }
}


async function waitTxidConfig(txid: string, waitBlock: number) {
    while(true) {
        const confirmations = await provider.getConfirmations(txid)
        if (confirmations >= waitBlock) {
            break
        }
        await new Promise(resolve => setTimeout(resolve, 10e3))
    }
    
}

function verifyBvm(psbt: ExtPsbt) {
    const inputCount = psbt.txInputs.length;
    for (let i = 0; i < inputCount; i++) {
        const verifyRes = bvmVerify(psbt, i);
        if (verifyRes !== true) {
            throw new Error(`bvm verify failed at input ${i}: ${verifyRes}`);
        }
    }
}

// console.log(getHashedMapConfig({map1: new HashedMap([]), map2: new HashedMap([])}))