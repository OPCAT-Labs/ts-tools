import { bvmVerify, DefaultSigner, ExtPsbt, hexToUint8Array, MempoolProvider, PrivateKey, Script } from "@opcat-labs/scrypt-ts-opcat"

const privateKey = PrivateKey.fromWIF('cQfb2vnBvKryZjG7MuWwDoeMpvHBNAqaNyJH3cNxdHxnHWd6Kv7f')
const signer = new DefaultSigner(privateKey)
const provider = new MempoolProvider('opcat-testnet')   


async function testOpcode(
    lockingCodes: string,
    unlockingCodes: string,
) {
    const address = await signer.getAddress()
    const lockingScript = Script.fromString(lockingCodes)
    const unlockingScript = Script.fromString(unlockingCodes)

    const utxos = await provider.getUtxos(address)

    const psbt = new ExtPsbt({network: 'opcat-testnet'})
        .spendUTXO(utxos)
        .addOutput({
            script: hexToUint8Array(lockingScript.toHex()),
            data: new Uint8Array(),
            value: 1n,
        })
        .change(address, await provider.getFeeRate())
        .seal()
    await psbt.signAndFinalize(signer);
    const utxo = psbt.getUtxo(0)
    const changeUtxo = psbt.getUtxo(1)


    const unlockPsbt = new ExtPsbt({network: 'opcat-testnet'})
        .addInput({
            hash: utxo.txId,
            index: utxo.outputIndex,
            opcatUtxo: {
                script: hexToUint8Array(utxo.script),
                data: hexToUint8Array(utxo.data),
                value: BigInt(utxo.satoshis),
            },
            sequence: 0,
            finalizer: () => unlockingScript
        })
        .spendUTXO(changeUtxo)
        .change(address, await provider.getFeeRate())
        .seal()
    
    await unlockPsbt.signAndFinalize(signer)
    const unlockVerify = bvmVerify(unlockPsbt, 0)
    if (unlockVerify !== true) {
        console.log('unlock verify failsed', unlockVerify)
        throw new Error('unlock verify failed')
    }
    console.log('lock', await provider.broadcast(psbt.extractTransaction().toHex()))
    console.log('unlock', await provider.broadcast(unlockPsbt.extractTransaction().toHex()))

}

async function main() {
    await testOpcode('OP_1ADD OP_2 OP_EQUAL', 'OP_1')
    await new Promise(resolve => setTimeout(resolve, 5000))
    await testOpcode('OP_2 OP_EQUAL', 'OP_1 OP_1ADD')
}

main()
