import * as dotenv from 'dotenv';
import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { PrivateKey, DefaultSigner, Address, Script, HashedMap, ByteString, toByteString, cloneDeep, ExtPsbt, hexToUint8Array, bvmVerify, PubKey } from '@opcat-labs/scrypt-ts-opcat';
import { AirdropBTC } from '../contracts/airdropBTC.js';
import { AirdropBTCStateLib, ClaimInfo } from '../contracts/airdropBTCStateLib.js';
import { AirdropBTCDelegator, AirdropBTCDelegatorState } from '../contracts/airdropBTCDelegator.js';

import { getDefaultSigner, getDummyUtxo, readArtifact } from '../utils';

dotenv.config();
use(chaiAsPromised);

describe('Test AirdropBTC', () => {
    const testSigner = getDefaultSigner()

    const addresses = [
        Script.fromAddress(Address.fromString('1NiNacS1FrNdd5WUudZePSsHi5ZzGNW9CC')).toHex(),
        Script.fromAddress(Address.fromString('1EdqjAnJewrPqAAZRpXQBmKrZD1T4JVmZn')).toHex(),
        Script.fromAddress(Address.fromString('12EAFPdb5ZmoXZzkhtZYYT7KidDbicf5wo')).toHex(),
        Script.fromAddress(Address.fromString('1B9ntPxHkuY1GyGqc1te1aqCZPNPbMgLfm')).toHex(),
    ]

    let contract: AirdropBTC
    before(() => {
        AirdropBTC.loadArtifact(readArtifact('airdropBTC.json'));
        AirdropBTCStateLib.loadArtifact(readArtifact('airdropBTCStateLib.json'));
        AirdropBTCDelegator.loadArtifact(readArtifact('airdropBTCDelegator.json'));

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

        const serializedState = AirdropBTCStateLib.serializeState({
            claimInfos: new HashedMap<ByteString, ClaimInfo, 1>([
                [addresses[0], {
                    amount: 300n,
                    claimed: false,
                }],
            ]),
        })

        contract = new AirdropBTC();
        contract.bindToUtxo({
            txId: 'c1a1a777a52f765ebfa295a35c12280279edd46073d41f4767602f819f574f82',
            outputIndex: 0,
            satoshis: 1e8,
            data: AirdropBTC.serializeState(state),
        });
        contract.state = state
    });

    it('should claim successfully', async () => {
        const nextState = cloneDeep(contract.state);
        nextState.claimInfos.set(addresses[0], { ...nextState.claimInfos.get(addresses[0]), claimed: true });

        const serializedState = AirdropBTC.serializeState(nextState);

        const claimAmount = nextState.claimInfos.get(addresses[0])!.amount;

        const nextContract = contract.next(nextState);
        const address = await testSigner.getAddress();
        const psbt = new ExtPsbt({ network: testSigner.network })
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

    it('should claim successfully with delegator', async () => {
        const nextState = cloneDeep(contract.state);
        nextState.claimInfos.set(addresses[0], { ...nextState.claimInfos.get(addresses[0]), claimed: true });

        const claimAmount = nextState.claimInfos.get(addresses[0])!.amount;

        const nextContract = contract.next(nextState);
        const address = await testSigner.getAddress();

        const [delegator, delegatorSigner] = await createDelegatorUtxo();
        const delegatorPubKey = await delegatorSigner.getPublicKey();
        const delegatorAddress = await delegatorSigner.getAddress();

        const psbt = new ExtPsbt({ network: testSigner.network })
            .addContractInput(contract, (airdropBTC, psbt) => {
                airdropBTC.claim(addresses[0]);
            })
            .addContractInput(delegator, (delegator, psbt) => {
                const sig = psbt.getSig(1, { address: delegatorAddress, publicKey: delegatorPubKey });
                delegator.unlock(contract.state, addresses[0], PubKey(delegatorPubKey), sig);
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

        const signedPsbtHex = await testSigner.signPsbt(psbt.toHex(), psbt.psbtOptions());
        const signedPsbtHex2 = await delegatorSigner.signPsbt(psbt.toHex(), psbt.psbtOptions());
        psbt.combine(ExtPsbt.fromHex(signedPsbtHex), ExtPsbt.fromHex(signedPsbtHex2)).finalizeAllInputs();
        expect(bvmVerify(psbt, 0)).to.eq(true);
        expect(bvmVerify(psbt, 1)).to.eq(true);
        expect(psbt.isFinalized).to.be.true;
    });

    async function createDelegatorUtxo() {
        const signer = new DefaultSigner();
        const address = await signer.getAddress();
        const delegatorState: AirdropBTCDelegatorState = {
            delegators: new HashedMap<ByteString, ByteString, 1>([
                [
                    addresses[0], 
                    Script.fromAddress(Address.fromString(address)).toHex()
                ],
            ]),
        }
        const delegator = new AirdropBTCDelegator();
        delegator.state = delegatorState;
        delegator.bindToUtxo({
            txId: 'be272f707260e9341a695e97a9d8d122b04970ac0f5af392242d9bf64c78b744',
            outputIndex: 0,
            satoshis: 1e8,
            data: AirdropBTCDelegator.serializeState(delegatorState),
        });
        delegator.state = delegatorState
        return [delegator, signer] as const
    }
});
