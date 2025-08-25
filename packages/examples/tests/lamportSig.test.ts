import { expect, use } from 'chai'
import {
    ByteString,
    byteStringToInt,
    hash256,
    lshift,
    slice,
    toByteString,
    and, deploy,
    call
} from '@opcat-labs/scrypt-ts'
import {
    LamportP2PK,
    LamportPubKey,
    LamportSig,
} from '@opcat-labs/examples'
import { getDefaultProvider, getDefaultSigner } from './utils/helper'
import chaiAsPromised from 'chai-as-promised'
import { PrivateKey } from '@opcat-labs/opcat'
use(chaiAsPromised)

type LamportSecretKey = ByteString

describe('Test SmartContract `LamportSig`', () => {
    let sk: LamportSecretKey
    let pk: LamportPubKey

    let contract: LamportP2PK
    const provider = getDefaultProvider()
    const signer = getDefaultSigner()

    before(async () => {

        sk = toByteString('')
        pk = toByteString('')
        for (let i = 0; i < 512; i++) {
            const skChunk = PrivateKey.fromRandom().toHex()
            sk += skChunk
            pk += hash256(skChunk)
        }

        contract = new LamportP2PK(pk)
    })

    it('should pass the public method unit test successfully.', async () => {
        const paymentAmt = 100

        const deployPsbt = await deploy(signer, provider, contract, paymentAmt)

        const deployTx = deployPsbt.extractTransaction();
        console.log(`Deployed contract "LamportSig": ${deployTx.id}`)
        expect(deployTx.id).to.have.length(64)

        // Sign tx.

        // Execute actual contract call.
        const callPsbt = await call(signer, provider, contract, (contract: LamportP2PK, psbt: IExtPsbt) => {
            const txSigHashPreimage = psbt.unsignedTx.getPreimage(0).toString('hex');
            let sig: LamportSig = toByteString('');
            const m = byteStringToInt(hash256(txSigHashPreimage))
            for (let i = 0; i < 256; i++) {
                let offset = 0n
                if (and(lshift(m, BigInt(i)), 1n) == 0n) {
                    offset = 256n * 32n
                }
    
                const start = BigInt(i) * 32n
                const skChunkStart = start + offset
                sig += slice(sk, skChunkStart, skChunkStart + 32n)
            }
            contract.unlock(sig)
        })


        const callTx = callPsbt.extractTransaction();
        expect(callTx.id).to.have.length(64)
    })

    it('should throw with wrong sig.', async () => {
        const paymentAmt = 100

        const deployPsbt = await deploy(signer, provider, contract, paymentAmt)

        const deployTx = deployPsbt.extractTransaction();
        console.log(`Deployed contract "LamportSig": ${deployTx.id}`)
        expect(deployTx.id).to.have.length(64)
        // Execute actual contract call.
        await expect(call(signer, provider, contract, (contract: LamportP2PK, psbt: IExtPsbt) => {
            const txSigHashPreimage = psbt.unsignedTx.getPreimage(0).toString('hex');
            let sig: LamportSig = toByteString('');
            const m = byteStringToInt(hash256(txSigHashPreimage))
            for (let i = 0; i < 256; i++) {
                let offset = 0n
                if (and(lshift(m, BigInt(i)), 1n) == 0n) {
                    offset = 256n * 32n
                }
    
                const start = BigInt(i) * 32n
                const skChunkStart = start + offset
                sig += slice(sk, skChunkStart, skChunkStart + 32n)
            }
            sig = slice(sig, 0n, 32n) +
                toByteString('00').repeat(32) +
                slice(sig, 64n)

            contract.unlock(sig)
        })).to.be.rejectedWith(/sig chunk 1 hash mismatch/)
    })

})
