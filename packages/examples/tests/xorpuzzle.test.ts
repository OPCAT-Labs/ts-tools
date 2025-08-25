import { expect, use } from 'chai'

import { XORPuzzle } from '@opcat-labs/examples'
import { crypto } from '@opcat-labs/opcat'
import { getDefaultProvider, getDefaultSigner, getRandomSigner, padLeadingZero } from './utils/helper'
import chaiAsPromised from 'chai-as-promised'
import { deploy, call, IExtPsbt, PubKey, toByteString } from '@opcat-labs/scrypt-ts'
use(chaiAsPromised)

describe('Test SmartContract `XORPuzzle`', async () => {
    let contract: XORPuzzle
    const provider = getDefaultProvider()
    const signer = getDefaultSigner()

    const address = await signer.getAddress();

    const data = '9999';
    const dataBuf = Buffer.from(data);
    const dataBufHash = crypto.Hash.sha256(dataBuf);
    const dataBufHashHex = dataBufHash.toString('hex');
    const dataBufHashBI = BigInt('0x' + dataBufHashHex);


    // for output of locking transaction
    const signerA = getRandomSigner();
    const publicKeyA = await signerA.getPublicKey();
    const addressA = await signerA.getAddress();


    const publicKeyData = publicKeyA + dataBufHashHex;

    const dataBuffer = Buffer.from(publicKeyData, 'hex');
    const publicKeyDataHash = crypto.Hash.sha256(dataBuffer);
    const publicKeyDataHashHex = publicKeyDataHash.toString('hex');

    const publicKeyDataHashBI = BigInt('0x' + publicKeyDataHashHex);
    const xorResult = dataBufHashBI ^ publicKeyDataHashBI;
    const xorResultHex = padLeadingZero(xorResult.toString(16));

    before(async () => {

        contract = new XORPuzzle(toByteString(xorResultHex))
    })

    it('check should succeed when correct data provided', async () => {
        const deployPsbt = await deploy(signer, provider, contract)

        expect(deployPsbt.extractTransaction().id).to.have.length(64)

        const callPsbt = await call(signerA, provider, contract, (contract: XORPuzzle, psbt: IExtPsbt) => {
            const sig = psbt.getSig(0, {
                address: addressA
            })
            contract.unlock(sig,
                PubKey(publicKeyA),
                toByteString(dataBufHashHex))
        })

        expect(callPsbt.extractTransaction().id).to.have.length(64)

    })

    it('check should fail when wrong data provided', async () => {
        const deployPsbt = await deploy(signer, provider, contract)

        expect(deployPsbt.extractTransaction().id).to.have.length(64)


        await expect(call(signerA, provider, contract, (contract: XORPuzzle, psbt: IExtPsbt) => {

            const data_false = '9998';
            const dataBuf_false = Buffer.from(data_false);
            const dataBufHash_false = crypto.Hash.sha256(dataBuf_false);
            const dataBufHashHex_false = dataBufHash_false.toString('hex');

            const sig = psbt.getSig(0, {
                address: addressA
            })
            contract.unlock(sig,
                PubKey(publicKeyA),
                toByteString(dataBufHashHex_false))
        })).to.be.rejected

    })
})
