import * as dotenv from 'dotenv';
import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { PrivateKey, DefaultSigner, Address, Script, HashedMap, ByteString, toByteString, attachToStateType, cloneDeep, ExtPsbt, hexToUint8Array, bvmVerify } from '@opcat-labs/scrypt-ts-opcat';
import { AirdropBTC, ClaimInfo } from '../contracts/airdropBTC.js';
import { getDummyUtxo, readArtifact } from '../utils';

dotenv.config();
use(chaiAsPromised);

describe('Test AirdropBTC', () => {
    const testSigner = new DefaultSigner(PrivateKey.fromWIF('cQfb2vnBvKryZjG7MuWwDoeMpvHBNAqaNyJH3cNxdHxnHWd6Kv7f'));

    const addresses = [
        Script.fromAddress(Address.fromString('1NiNacS1FrNdd5WUudZePSsHi5ZzGNW9CC')).toHex(),
        Script.fromAddress(Address.fromString('1EdqjAnJewrPqAAZRpXQBmKrZD1T4JVmZn')).toHex(),
        Script.fromAddress(Address.fromString('12EAFPdb5ZmoXZzkhtZYYT7KidDbicf5wo')).toHex(),
        Script.fromAddress(Address.fromString('1B9ntPxHkuY1GyGqc1te1aqCZPNPbMgLfm')).toHex(),
    ]

    let contract: AirdropBTC
    before(() => {
        AirdropBTC.loadArtifact(readArtifact('airdropBTC.json'));
        contract = new AirdropBTC();
        const state = {
            claimInfos: new HashedMap<ByteString, ClaimInfo, 1>([
                [addresses[0], {
                    amount: 300n,
                    claimed: false,
                }],
                [addresses[1], {
                    amount: 400n,
                    claimed: false,
                }],
                [addresses[2], {
                    amount: 500n,
                    claimed: false,
                }],
                [addresses[3], {
                    amount: 600n,
                    claimed: false,
                }],
            ]),
        }
        contract.bindToUtxo({
            txId: 'c1a1a777a52f765ebfa295a35c12280279edd46073d41f4767602f819f574f82',
            outputIndex: 0,
            satoshis: 1e8,
            data: AirdropBTC.serializeState(state)
        });
        contract.state = state
        

        // console.log('root', contract.state.claimInfos.getRoot());    
    });


    it('should claim successfully', async () => {
        // await contract.claim(addresses[0])
        const nextState = cloneDeep(contract.state);
        nextState.claimInfos.set(addresses[0], {...nextState.claimInfos.get(addresses[0]), claimed: true});

        const serializedState = AirdropBTC.serializeState(nextState);
        console.log('serializedState', serializedState);

        const claimAmount = nextState.claimInfos.get(addresses[0])!.amount;

        const nextContract = contract.next(nextState);
        const address = await testSigner.getAddress();
        const psbt = new ExtPsbt({network: testSigner.network})
        .addContractInput(contract, (airdropBTC, psbt) => {
            airdropBTC.claim(addresses[0]);
        })
        .spendUTXO(getDummyUtxo(address))
        .addContractOutput(nextContract, contract.utxo!.satoshis - Number(claimAmount))
        .addOutput({
            script: hexToUint8Array(addresses[0]),
            value: claimAmount,
            data: new Uint8Array()
        })
        .change(await testSigner.getAddress(), 1)
        .seal()
    
        await psbt.signAndFinalize(testSigner)
        expect(bvmVerify(psbt, 0)).to.eq(true);

        expect(psbt.isFinalized).to.be.true;
    });

});
