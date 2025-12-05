import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { isLocalTest } from '../utils';
import { testProvider } from '../utils/testProvider';
import { loadAllArtifacts } from '../features/cat721/utils';
import { ExtPsbt, fill, getBackTraceInfo, PubKey, sha256, toByteString, toHex, uint8ArrayToHex, slice, intToByteString, Transaction } from '@opcat-labs/scrypt-ts-opcat';
import { testSigner } from '../utils/testSigner';
import {createCat721, TestCat721} from '../utils/testCAT721Generator';
import { CAT721, CAT721State, CAT721StateLib, CAT721GuardStateLib, CAT721Guard_6_6_2, CAT721Guard_12_12_2 } from '../../src/contracts';
import { ContractPeripheral, CAT721GuardPeripheral } from '../../src/utils/contractPeripheral';
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
        const outputStates: CAT721State[] = outputLocalIds.map((localId) => {
            return {
                ownerAddr: CAT721.deserializeState(cat721.utxos[0].data).ownerAddr,
                localId: localId,
            };
        });

        // For incorrectAmount tests, we need to manually create the guard
        // Calculate txInputCountMax and txOutputCountMax directly
        const TX_INPUT_COUNT_MAX_6 = 6;
        const TX_INPUT_COUNT_MAX_12 = 12;
        const TX_OUTPUT_COUNT_MAX_6 = 6;
        const TX_OUTPUT_COUNT_MAX_12 = 12;

        const inputCount = cat721.utxos.length + 1; // +1 for the guard input
        const outputCount = outputLocalIds.length;
        const txInputCountMax = inputCount <= TX_INPUT_COUNT_MAX_6 ? TX_INPUT_COUNT_MAX_6 : TX_INPUT_COUNT_MAX_12;
        const txOutputCountMax = (inputCount <= TX_INPUT_COUNT_MAX_6 && outputCount <= TX_OUTPUT_COUNT_MAX_6)
            ? TX_OUTPUT_COUNT_MAX_6
            : TX_OUTPUT_COUNT_MAX_12;

        // Select appropriate guard based on input and output counts
        const guard = (inputCount <= TX_INPUT_COUNT_MAX_6 && outputCount <= TX_OUTPUT_COUNT_MAX_6)
            ? new CAT721Guard_6_6_2()
            : new CAT721Guard_12_12_2();

        // Manually construct the guardState with burn masks for testing
        const guardState = CAT721GuardStateLib.createEmptyState(txInputCountMax);
        guardState.nftScriptHashes[0] = ContractPeripheral.scriptHash(cat721.utxos[0].script);

        // Build nftScriptIndexes
        let nftScriptIndexes = guardState.nftScriptIndexes;
        for (let index = 0; index < cat721.utxos.length; index++) {
            const before = slice(nftScriptIndexes, 0n, BigInt(index));
            const after = slice(nftScriptIndexes, BigInt(index + 1));
            nftScriptIndexes = before + intToByteString(0n, 1n) + after;
        }
        guardState.nftScriptIndexes = nftScriptIndexes;

        // Build burn masks
        let nftBurnMasks = guardState.nftBurnMasks;
        for (let inputIndex = 0; inputIndex < cat721.utxos.length; inputIndex++) {
            const nftState = CAT721StateLib.deserializeState(cat721.utxos[inputIndex].data);
            if (burnLocalIds.includes(BigInt(nftState.localId))) {
                const before = slice(nftBurnMasks, 0n, BigInt(inputIndex));
                const after = slice(nftBurnMasks, BigInt(inputIndex + 1));
                nftBurnMasks = before + toByteString('01') + after;
            }
        }
        guardState.nftBurnMasks = nftBurnMasks;

        guard.state = guardState;
        const guardScriptHashes = CAT721GuardPeripheral.getGuardVariantScriptHashes();
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
        const cat721OutputStartIndex = 0;
        const cat721InputStartIndex = 0;
        const psbt = new ExtPsbt({
            network: await testProvider.getNetwork(),
            maximumFeeRate: 1e8,
        });

        cat721.utxos.forEach((utxo, inputIndex) => {
            const cat721Contract = new CAT721(cat721.generator.minterScriptHash, cat721.generator.guardScriptHashes).bindToUtxo({
                ...utxo,
                txHashPreimage: toHex(new Transaction(cat721.utxoTraces[inputIndex].prevTxHex).toTxHashPreimage()),
            });
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
            const ownerAddrOrScripts = fill(toByteString(''), txOutputCountMax);
            {
                const outputScriptHashes = curPsbt.txOutputs
                    .map((output) => toByteString(sha256(uint8ArrayToHex(output.script))));
                applyFixedArray(ownerAddrOrScripts, outputScriptHashes, cat721OutputStartIndex);
                const cat721OwnerAddrs = outputStates.map((state) => state.ownerAddr);
                applyFixedArray(ownerAddrOrScripts, cat721OwnerAddrs, cat721OutputStartIndex);
            }
            const _outputLocalIds = fill(-1n, txOutputCountMax);
            {
                if (outputHasCat721) {
                    applyFixedArray(_outputLocalIds, outputLocalIds, cat721OutputStartIndex);
                }
            }
            const nftScriptIndexes = fill(-1n, txOutputCountMax);
            {
                if (outputHasCat721) {
                    applyFixedArray(
                        nftScriptIndexes,
                        outputLocalIds.map(() => 0n),
                        cat721OutputStartIndex,
                    );
                }
            }
            const outputSatoshis = fill(0n, txOutputCountMax);
            {
                applyFixedArray(outputSatoshis, curPsbt.txOutputs.map((output) => BigInt(output.value)));
            }
            const cat721States = fill(CAT721StateLib.create(0n, toByteString('')), txInputCountMax);
            {
                applyFixedArray(
                    cat721States,
                    cat721.utxos.map((utxo) => CAT721StateLib.deserializeState(utxo.data)),
                    cat721InputStartIndex,
                );
            }
            const outputCount = curPsbt.txOutputs.length;
            const nextStateHashes = fill(toByteString(''), txOutputCountMax)
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
            const cat721Contract = new CAT721(cat721.generator.minterScriptHash, cat721.generator.guardScriptHashes)
            cat721Contract.state = state;
            psbt.addContractOutput(cat721Contract, Postage.NFT_POSTAGE);
        });

        const signedPsbtHex = await testSigner.signPsbt(psbt.seal().toHex(), psbt.psbtOptions());
        psbt.combine(ExtPsbt.fromHex(signedPsbtHex)).finalizeAllInputs();
        expect(psbt.isFinalized).to.be.true;
    }
});
