import { HashedMap, HashedMapAbiUtil, PrivateKey, sha256, deploy, DefaultSigner, MempoolProvider, UTXO, ExtPsbt, Sha256, ByteString, cloneDeep, Int32, bvmVerify, HashedMapTrackerProvider, call, FixedArray } from '@opcat-labs/scrypt-ts-opcat'
import * as fs from 'fs'
import * as path from 'path'
import {Struct1, TestHashedMap2, TestHashedMap2State} from './src/contracts/testHashedMap2.js'
import * as testHashedMap2 from './artifacts/contracts/testHashedMap2.json'

const privateKey = PrivateKey.fromWIF('cQfb2vnBvKryZjG7MuWwDoeMpvHBNAqaNyJH3cNxdHxnHWd6Kv7f')
const signer = new DefaultSigner(privateKey)
const provider = new MempoolProvider('opcat-testnet')
const hashedMapTrackerProvider = new HashedMapTrackerProvider('http://localhost:3000')
TestHashedMap2.loadArtifact(testHashedMap2)

test()

async function test() {
    const configs = getHashedMapTrackerConfig()
    const date = new Date().toISOString()
    const fileName = `testHashedMap2_${date.replaceAll(':', '_')}.json`
    fs.writeFileSync(path.resolve(__dirname, 'tmp', fileName), JSON.stringify(configs, null, 2))
    await runTestCase()
}

function getHashedMapTrackerConfig(
) {
    const mainContract = new TestHashedMap2()
    let configs = [
        HashedMapAbiUtil.exportHashedMapTrackerConfig(
            new TestHashedMap2(),
            'x.y[0].map',
            [],
            [
                {
                    contract: mainContract,
                    methodName: 'changeMap',
                    methodParamName: 'this.state',
                }
            ]
        ),
        HashedMapAbiUtil.exportHashedMapTrackerConfig(
            new TestHashedMap2(),
            'x.y[1].map',
            [],
            [
                {
                    contract: mainContract,
                    methodName: 'changeMap',
                    methodParamName: 'this.state',
                }
            ]
        )
    ]
    return configs
}

async function runTestCase() {
    const mainContract = new TestHashedMap2()
    const utxos = await provider.getUtxos(mainContract.lockingScript.toHex())
    let utxo = utxos[0]
    let feeUtxos = await provider.getUtxos(await signer.getAddress())
    let feeUtxo = feeUtxos[0]
    if (!utxo) {
        mainContract.state = {
            x: {
                y: [
                    {map: new HashedMap<ByteString, ByteString, 1>([]), a: 0n},
                    {map: new HashedMap<ByteString, ByteString, 1>([]), a: 0n}
                ] as FixedArray<Struct1, 2>
            }
        }
        const psbt = await deploy(signer, provider, mainContract)
        utxo = psbt.getUtxo(0)
        feeUtxo = psbt.getUtxo(1)
        console.log('deploy txid: ', psbt.extractTransaction().id)
    }

    await mainContract.asyncBindToUtxo(
        utxo,
        HashedMapTrackerProvider.bindUtxoCallback(hashedMapTrackerProvider)
    )

    const updateKeyValues = [
        {key: '01', value: mainContract.state.x.y[0].map.get('01') + '01'},
        {key: '02', value: mainContract.state.x.y[1].map.get('02') + '02'}
    ]

    const nextState = cloneDeep(mainContract.state)
    nextState.x.y[0].map.set(updateKeyValues[0].key, updateKeyValues[0].value)
    nextState.x.y[1].map.set(updateKeyValues[1].key, updateKeyValues[1].value)
    const nextContract = mainContract.next(nextState)

    const callPsbt = new ExtPsbt({network: await provider.getNetwork()})
       .addContractInput(mainContract, (contract) => {
            contract.changeMap(updateKeyValues[0].key, updateKeyValues[0].value, updateKeyValues[1].key, updateKeyValues[1].value)
       })
       .spendUTXO(feeUtxo)
       .addContractOutput(nextContract, 1)
       .change(await signer.getAddress(), await provider.getFeeRate())
       .seal()
    const signedPsbtHex = await signer.signPsbt(callPsbt.toHex(), callPsbt.psbtOptions())
    const signedPsbt = callPsbt.combine(ExtPsbt.fromHex(signedPsbtHex)).finalizeAllInputs()
    const callTx = signedPsbt.extractTransaction()
    await provider.broadcast(callTx.toHex())
    console.log('call txid: ', callTx.id)
}