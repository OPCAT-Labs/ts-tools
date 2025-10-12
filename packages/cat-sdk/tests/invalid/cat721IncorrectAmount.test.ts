import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { isLocalTest } from '../utils';
import { testProvider } from '../utils/testProvider';
import { loadAllArtifacts } from '../features/cat721/utils';
import { ExtPsbt, fill, getBackTraceInfo, PubKey, sha256, toByteString, toHex, uint8ArrayToHex } from '@opcat-labs/scrypt-ts-opcat';
import { testSigner } from '../utils/testSigner';
import {createCat721, TestCat721} from '../utils/testCAT721Generator';
import { CAT20, CAT20Guard, CAT20GuardStateLib, CAT20State, CAT20StateLib, CAT721, CAT721Guard, CAT721GuardStateLib, CAT721State, CAT721StateLib, ConstantsLib, TX_INPUT_COUNT_MAX, TX_OUTPUT_COUNT_MAX } from '../../src/contracts';
import { ContractPeripheral } from '../../src/utils/contractPeripheral';
import { applyFixedArray, getDummyUtxo } from '../../src/utils';
import { Postage } from '../../src/typeConstants';
use(chaiAsPromised)

isLocalTest(testProvider) && describe('Test cat721 incorrect amount/localId', async () => {
    let mainAddress: string;
    let mainPubKey: PubKey

    before(async () => {
        loadAllArtifacts();
        mainAddress = await testSigner.getAddress();
        mainPubKey = PubKey(await testSigner.getPublicKey());
    });

    it('should be success on transfer, burn, and both when input amount is equal to output amount', async () => {
        const cat721 = await createCat721('test', 2, mainAddress);
        await testCase(cat721, [0n, 1n], []);
        await testCase(cat721, [], [0n, 1n])
        await testCase(cat721, [0n], [1n]);
    });

    describe('should be failed when output amount is less than the input amount', async () => {
        it('failed on transfer: 2 inputs, 1 output', async () => {
            const cat721 = await createCat721('test', 2, mainAddress);
            return expect(testCase(cat721, [0n], [])).to.eventually.be.rejectedWith(
                'Execution failed, next nft count is invalid',
            );
        });
        it('failed on burn: 3 inputs, 1 output, 1 burn', async () => {
            const cat721 = await createCat721('test', 3, mainAddress);
            return expect(testCase(cat721, [0n], [1n])).to.eventually.be.rejectedWith(
                'Execution failed, next nft count is invalid',
            );
        });
    });

    describe('should be failed when output amount is greater than the input amount', async () => {
        it('failed on transfer: 2 inputs, 3 output', async () => {
            const cat721 = await createCat721('test', 2, mainAddress);
            return expect(testCase(cat721, [0n, 1n, 3n], [])).to.eventually.be.rejectedWith(
                'Execution failed, next nft is invalid',
            );
        });
        it('failed on burn: 1 inputs, 1 output, 1 burn', async () => {
            const cat721 = await createCat721('test', 1, mainAddress);
            return expect(testCase(cat721, [0n], [0n])).to.eventually.be.rejectedWith(
                'Execution failed, next nft is invalid',
            );
        });
        it('failed on both transfer and burn: 1 inputs, 2 output, 1 burn', async () => {
            const cat721 = await createCat721('test', 1, mainAddress);
            return expect(testCase(cat721, [0n, 1n], [2n])).to.eventually.be.rejectedWith(
                'Execution failed, next nft is invalid',
            );
        });
    });

    async function testCase(cat721: TestCat721, outputLocalIds: bigint[], burnLocalIds: bigint[]) {
        const guardState = CAT721GuardStateLib.createEmptyState();

        // only 1 type token
        guardState.nftScriptHashes[0] = ContractPeripheral.scriptHash(cat721.utxos[0].script);
        cat721.utxos.forEach((utxo, inputIndex) => {
            const nftState = CAT721StateLib.deserializeState(utxo.data);
            // set burn mask
            if (burnLocalIds.includes(BigInt(nftState.localId))) {
                guardState.nftBurnMasks[inputIndex] = true;
            }

            guardState.nftScriptIndexes[inputIndex] = BigInt(0);
        });
        
        const outputStates: CAT721State[] = outputLocalIds.map((localId) => {
            return {
                tag: ConstantsLib.OPCAT_CAT721_TAG,
                ownerAddr: CAT721.deserializeState(cat721.utxos[0].data).ownerAddr,
                localId: localId,
            };
        });

        const guard = new CAT721Guard();
        guard.state = guardState;
        {
            const psbt = new ExtPsbt({
                network: await testProvider.getNetwork(),
                maximumFeeRate: 1e8,
            })
                .spendUTXO(getDummyUtxo(mainAddress))
                // 1e8 is enough for the next txn's fee
                .addContractOutput(guard, 1e8)
                .seal();
            const signedPsbtHex = await testSigner.signPsbt(psbt.seal().toHex(), psbt.psbtOptions());
            psbt.combine(ExtPsbt.fromHex(signedPsbtHex)).finalizeAllInputs();
        }

        const guardInputIndex = cat721.utxos.length;
        const psbt = new ExtPsbt({
            network: await testProvider.getNetwork(),
            maximumFeeRate: 1e8,
        });

        cat721.utxos.forEach((utxo, inputIndex) => {
            const cat721Contract = new CAT721(cat721.generator.minterScriptHash, cat721.generator.guardScriptHash).bindToUtxo(utxo);
            psbt.addContractInput(cat721Contract, (contract, curPsbt) => {
                contract.unlock(
                    {
                        userPubKey: mainPubKey,
                        userSig: curPsbt.getSig(inputIndex, { address: mainAddress }),
                        contractInputIndex: -1n,
                    },
                    guardState,
                    BigInt(guardInputIndex),
                    getBackTraceInfo(cat721.utxoTraces[inputIndex].prevTxHex, cat721.utxoTraces[inputIndex].prevPrevTxHex, cat721.utxoTraces[inputIndex].prevTxInput),
                );
            });
        });
        const outputHasCat721 = outputLocalIds.length > 0;
        psbt.addContractInput(guard, (contract, curPsbt) => {
            const ownerAddrOrScripts = fill(toByteString(''), TX_OUTPUT_COUNT_MAX);
            {
                const outputScriptHashes = curPsbt.txOutputs
                    .map((output) => toByteString(sha256(uint8ArrayToHex(output.script))));
                applyFixedArray(ownerAddrOrScripts, outputScriptHashes, cat721OutputStartIndex);
                const cat721OwnerAddrs = outputStates.map((state) => state.ownerAddr);
                applyFixedArray(ownerAddrOrScripts, cat721OwnerAddrs, cat721OutputStartIndex);
            }
            const _outputLocalIds = fill(-1n, TX_OUTPUT_COUNT_MAX);
            {
                if (outputHasCat721) {
                    applyFixedArray(_outputLocalIds, outputLocalIds, cat721OutputStartIndex);
                }
            }
            const nftScriptIndexes = fill(-1n, TX_OUTPUT_COUNT_MAX);
            {
                if (outputHasCat721) {
                    applyFixedArray(
                        nftScriptIndexes,
                        outputLocalIds.map(() => 0n),
                        cat721OutputStartIndex,
                    );
                }
            }
            const outputSatoshis = fill(0n, TX_OUTPUT_COUNT_MAX);
            {
                applyFixedArray(outputSatoshis, curPsbt.txOutputs.map((output) => BigInt(output.value)));
            }
            const cat721States = fill(CAT721StateLib.create(0n, toByteString('')), TX_INPUT_COUNT_MAX);
            {
                applyFixedArray(
                    cat721States,
                    cat721.utxos.map((utxo) => CAT721StateLib.deserializeState(utxo.data)),
                    cat721InputStartIndex,
                );
            }
            const outputCount = curPsbt.txOutputs.length;
            const nextStateHashes = fill(toByteString(''), TX_OUTPUT_COUNT_MAX)
            applyFixedArray(
              nextStateHashes,
              curPsbt.txOutputs.map((output) => sha256(toHex(output.data)))
            )
            contract.unlock(
                nextStateHashes,
                ownerAddrOrScripts,
                _outputLocalIds,
                nftScriptIndexes,
                outputSatoshis,
                cat721States,
                BigInt(outputCount),
            );
        });
        outputStates.forEach((state) => {
            const cat721Contract = new CAT721(cat721.generator.minterScriptHash, cat721.generator.guardScriptHash)
            cat721Contract.state = state;
            psbt.addContractOutput(cat721Contract, Postage.NFT_POSTAGE);
        });

        const cat721OutputStartIndex = 0;
        const cat721InputStartIndex = 0;
        const signedPsbtHex = await testSigner.signPsbt(psbt.seal().toHex(), psbt.psbtOptions());
        psbt.combine(ExtPsbt.fromHex(signedPsbtHex)).finalizeAllInputs();
        expect(psbt.isFinalized).to.be.true;
    }
});
