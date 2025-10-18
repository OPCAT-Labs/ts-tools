import { expect, use } from 'chai'
import chaiAsPromised from 'chai-as-promised'
import {
    PubKey,
    FixedArray,
    Addr,
    Signer,
    addrToPkh,
    deploy,
    call,
    IExtPsbt,
    ExtPsbt,
} from '@opcat-labs/scrypt-ts-opcat'
import { MultiSigPayment } from '..'
import { getDefaultProvider, getRandomSigner } from './utils/helper'

use(chaiAsPromised)

const signers: Array<Signer> = [];
const addresses: Array<string> = [];
const publicKeys: Array<string> = []



describe('Test SmartContract `P2MS`', () => {

    const provider = getDefaultProvider()

    before(async () => {

        for (let i = 0; i < 3; i++) {
            const signer = getRandomSigner();

            signers.push(signer)

            const address = await signer.getAddress()

            addresses.push(address)

            const publicKey = await signer.getPublicKey()

            publicKeys.push(publicKey)

        }

    })



    it('should pass if using right private keys', async () => {
        const multiSigPayment = new MultiSigPayment(
            addresses.map((addr) => {
                return Addr(addrToPkh(addr))
            }) as FixedArray<Addr, 3>
        )

        const deployPsbt = await deploy(signers[0], provider, multiSigPayment)

        const deployTx = deployPsbt.extractTransaction()

        console.log('MultiSigPayment deployed txid: ', deployTx.id)
        expect(deployTx.id).to.have.length(64)
        const signedPsbt = await call(signers[0], provider, multiSigPayment, (contract: MultiSigPayment, psbt: IExtPsbt) => {
            const sig1 = psbt.getSig(0, {
                address: addresses[0]
            })
            const sig2 = psbt.getSig(0, {
                address: addresses[1]
            })
            const sig3 = psbt.getSig(0, {
                address: addresses[2]
            })
            contract.unlock([sig1, sig2, sig3], publicKeys.map(publicKey => PubKey(publicKey)) as FixedArray<PubKey, 3>)
        }, {
            unfinalize: true
        })



        const partialSigedPsbt1Hex = await signers[1].signPsbt(signedPsbt.toHex(), signedPsbt.psbtOptions());

        signedPsbt.combine(ExtPsbt.fromHex(partialSigedPsbt1Hex));

        const partialSigedPsbt2Hex = await signers[2].signPsbt(signedPsbt.toHex(), signedPsbt.psbtOptions());
        signedPsbt.combine(ExtPsbt.fromHex(partialSigedPsbt2Hex));

        signedPsbt.finalizeAllInputs();
        const callTx = signedPsbt.extractTransaction();
        await provider.broadcast(callTx.toHex());
        console.log('MultiSigPayment called txid: ', callTx.id)
        expect(callTx.id).to.have.length(64)
    })

    it('should not pass if using wrong sig', async () => {
        const multiSigPayment = new MultiSigPayment(
            addresses.map((addr) => {
                return Addr(addrToPkh(addr))
            }) as FixedArray<Addr, 3>
        )

        const deployPsbt = await deploy(signers[0], provider, multiSigPayment)

        const deployTx = deployPsbt.extractTransaction()

        console.log('MultiSigPayment deployed txid: ', deployTx.id)
        expect(deployTx.id).to.have.length(64)
        const signedPsbt = await call(signers[0], provider, multiSigPayment, (contract: MultiSigPayment, psbt: IExtPsbt) => {
            const sig1 = psbt.getSig(0, {
                address: addresses[0]
            })
            const sig2 = psbt.getSig(0, {
                address: addresses[1]
            })
            const sig3 = psbt.getSig(0, {
                address: addresses[2]
            })
            contract.unlock([sig1, sig2, sig3], publicKeys.map(publicKey => PubKey(publicKey)) as FixedArray<PubKey, 3>)
        }, {
            unfinalize: true
        })



        const partialSigedPsbt1Hex = await signers[1].signPsbt(signedPsbt.toHex(), signedPsbt.psbtOptions());

        signedPsbt.combine(ExtPsbt.fromHex(partialSigedPsbt1Hex));

        const wrongSigner = getRandomSigner();


        const partialSigedPsbt2Hex = await wrongSigner.signPsbt(signedPsbt.toHex(), signedPsbt.psbtOptions());
        signedPsbt.combine(ExtPsbt.fromHex(partialSigedPsbt2Hex));


        expect(() => {

            signedPsbt.finalizeAllInputs();
        }).to.throw('checkMultiSig failed');

    })
})
