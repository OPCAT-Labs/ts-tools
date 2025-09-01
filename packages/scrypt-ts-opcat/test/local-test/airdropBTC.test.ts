import * as dotenv from 'dotenv';
import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { PrivateKey, DefaultSigner, Address, Script, HashedMap, ByteString, toByteString, attachToStateType } from '@opcat-labs/scrypt-ts-opcat';
import { AirdropBTC, ClaimInfo } from '../contracts/airdropBTC.js';
import { readArtifact } from '../utils';

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
        contract.state = {
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
        attachToStateType(AirdropBTC.artifact, contract.state);
        contract.state.claimInfos.
        // contract.bindToUtxo({
        //     txId: 'c1a1a777a52f765ebfa295a35c12280279edd46073d41f4767602f819f574f82',
        //     outputIndex: 0,
        //     satoshis: 10000,
        //     data: AirdropBTC.serializeState(contract.state)
        // });
    
    });


    it('should claim successfully', async () => {
        // await contract.claim(addresses[0])
    });

});
