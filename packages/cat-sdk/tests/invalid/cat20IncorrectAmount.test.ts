import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { isLocalTest } from '../utils';
import { testProvider } from '../utils/testProvider';
import { loadAllArtifacts } from '../features/cat20/utils';
import { ExtPsbt, fill, getBackTraceInfo, PubKey, sha256, toByteString, toHex, uint8ArrayToHex } from '@opcat-labs/scrypt-ts-opcat';
import { testSigner } from '../utils/testSigner';
import {createCat20, TestCat20} from '../utils/testCAT20Generator';
import { CAT20, CAT20Guard, CAT20GuardStateLib, CAT20State, CAT20StateLib, ConstantsLib, TX_INPUT_COUNT_MAX, TX_OUTPUT_COUNT_MAX } from '../../src/contracts';
import { ContractPeripheral } from '../../src/utils/contractPeripheral';
import { applyFixedArray, getDummyUtxo } from '../../src/utils';
import { Postage } from '../../src/typeConstants';
use(chaiAsPromised)

isLocalTest(testProvider) && describe('Test incorrect amount for cat20', () => {
    let mainAddress: string;
    let mainPubKey: PubKey

    before(async () => {
        loadAllArtifacts();
        mainAddress = await testSigner.getAddress();
        mainPubKey = PubKey(await testSigner.getPublicKey());
    });

    it('should transfer, burn, and both when input amount is equal to output amount successfully', async () => {
        const cat20 = await createCat20([1000n], mainAddress, 'test');
        await testCase(cat20, [1000n], [0n]);
        await testCase(cat20, [], [1000n])
        await testCase(cat20, [500n], [500n]);
    });

    describe('When output amount is less than the input amount', async () => {
        it('should fail on transfer: input=1000, output=999, burn=0', async () => {
            const cat20 = await createCat20([1000n], mainAddress, 'test');
            return expect(testCase(cat20, [999n], [])).to.eventually.be.rejectedWith(
                'Execution failed, sum input tokens is invalid, should be equal to sum output tokens plus sum burn tokens',
            );
        });
        it('should fail on burn: input=1000, output=0, burn=999', async () => {
            const cat20 = await createCat20([1000n], mainAddress, 'test');
            return expect(testCase(cat20, [], [999n])).to.eventually.be.rejectedWith(
                'Execution failed, sum input tokens is invalid, should be equal to sum output tokens plus sum burn tokens',
            );
        });
        it('should fail on both transfer and burn: input=1000, output=500, burn=499', async () => {
            const cat20 = await createCat20([1000n], mainAddress, 'test');
            return expect(testCase(cat20, [500n], [499n])).to.eventually.be.rejectedWith(
                'Execution failed, sum input tokens is invalid, should be equal to sum output tokens plus sum burn tokens',
            );
        });
    });

    describe('When output amount is greater than the input amount', async () => {
        it('should fail on transfer: input=1000, output=1001, burn=0', async () => {
            const cat20 = await createCat20([1000n], mainAddress, 'test');
            return expect(testCase(cat20, [1001n], [])).to.eventually.be.rejectedWith(
                'Execution failed, sum input tokens is invalid, should be equal to sum output tokens plus sum burn tokens',
            );
        });
        it('should fail on burn: input=1000, output=0, burn=1001', async () => {
            const cat20 = await createCat20([1000n], mainAddress, 'test');
            return expect(testCase(cat20, [], [1001n])).to.eventually.be.rejectedWith(
                'Execution failed, sum input tokens is invalid, should be equal to sum output tokens plus sum burn tokens',
            );
        });
        it('should fail on both transfer and burn: input=1000, output=500, burn=501', async () => {
            const cat20 = await createCat20([1000n], mainAddress, 'test');
            return expect(testCase(cat20, [500n], [501n])).to.eventually.be.rejectedWith(
                'Execution failed, sum input tokens is invalid, should be equal to sum output tokens plus sum burn tokens',
            );
        });
    });

    async function testCase(cat20: TestCat20, outputAmountList: bigint[], burnAmountList: bigint[]) {
        const guardState = CAT20GuardStateLib.createEmptyState();

        // only 1 type token
        guardState.tokenScriptHashes[0] = ContractPeripheral.scriptHash(cat20.utxos[0].script);
        guardState.tokenAmounts[0] = cat20.utxos.reduce((acc, utxo) => acc + CAT20.deserializeState(utxo.data).amount, 0n);
        guardState.tokenBurnAmounts[0] = burnAmountList.reduce((acc, amount) => acc + amount, 0n);

        const outputStates: CAT20State[] = outputAmountList
            .filter((amount) => amount > 0n)
            .map((amount) => ({
                ownerAddr: CAT20.deserializeState(cat20.utxos[0].data).ownerAddr,
                amount,
            }));
        const outputHasCat20 = outputStates.length > 0;
        cat20.utxos.forEach((utxo, i) => {
            guardState.tokenScriptIndexes[i] = 0n;
        });

        const guard = new CAT20Guard();
        guard.state = guardState;
        {
            const psbt = new ExtPsbt({network: await testProvider.getNetwork(), maximumFeeRate: 1e8}).spendUTXO(getDummyUtxo(mainAddress)).addContractOutput(guard, 1e8);
            const signedPsbtHex = await testSigner.signPsbt(psbt.seal().toHex(), psbt.psbtOptions());
            psbt.combine(ExtPsbt.fromHex(signedPsbtHex)).finalizeAllInputs();
        }

        const guardInputIndex = cat20.utxos.length;
        const psbt = new ExtPsbt({network: await testProvider.getNetwork(), maximumFeeRate: 1e8});
        cat20.utxos.forEach((utxo, inputIndex) => {
            const cat20Contract = new CAT20(cat20.generator.minterScriptHash, cat20.generator.guardScriptHash).bindToUtxo(utxo);
            psbt.addContractInput(cat20Contract, (contract, curPsbt) => {
                contract.unlock(
                    {
                        userPubKey: mainPubKey,
                        userSig: curPsbt.getSig(inputIndex, { address: mainAddress }),
                        contractInputIndex: -1n,
                    },
                    guardState,
                    BigInt(guardInputIndex),
                    getBackTraceInfo(cat20.utxoTraces[inputIndex].prevTxHex, cat20.utxoTraces[inputIndex].prevPrevTxHex, cat20.utxoTraces[inputIndex].prevTxInput),
                );
            });
        });
        psbt.addContractInput(guard, (contract, curPsbt) => {
            const cat20OutputStartIndex = 0;
            const cat20InputStartIndex = 0;
            const ownerAddrOrScripts = fill(toByteString(''), TX_OUTPUT_COUNT_MAX);
            {
                const outputScriptHashes = curPsbt.txOutputs
                    .map((output) => toByteString(sha256(uint8ArrayToHex(output.script))));
                applyFixedArray(ownerAddrOrScripts, outputScriptHashes, cat20OutputStartIndex);
                const cat20OwnerAddrs = outputStates.map((state) => state.ownerAddr);
                applyFixedArray(ownerAddrOrScripts, cat20OwnerAddrs, cat20OutputStartIndex);
            }

            const outputTokens = fill(0n, TX_OUTPUT_COUNT_MAX);
            {
                const cat20OutputAmounts = outputStates.map((state) => state.amount);
                if (outputHasCat20) {
                    applyFixedArray(outputTokens, cat20OutputAmounts, cat20OutputStartIndex);
                }
            }

            const tokenScriptIndexes = fill(-1n, TX_OUTPUT_COUNT_MAX);
            {
                const cat20ScriptOutputIndexes = outputStates.map(() => 0n);
                if (outputHasCat20) {
                    applyFixedArray(tokenScriptIndexes, cat20ScriptOutputIndexes, cat20OutputStartIndex);
                }
            }

            const outputSatoshis = fill(0n, TX_OUTPUT_COUNT_MAX);
            {
                applyFixedArray(outputSatoshis, curPsbt.txOutputs.map((output) => BigInt(output.value)));
            }
            const cat20States = fill(CAT20StateLib.create(0n, toByteString('')), TX_INPUT_COUNT_MAX);
            {
                const inputCat20States = cat20.utxos.map((utxo) => CAT20.deserializeState(utxo.data));
                applyFixedArray(cat20States, inputCat20States, cat20InputStartIndex);
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
                outputTokens,
                tokenScriptIndexes,
                outputSatoshis,
                cat20States,
                BigInt(outputCount),
            );
        });
        outputStates.forEach((state) => {
            const cat20Contract = new CAT20(cat20.generator.minterScriptHash, cat20.generator.guardScriptHash)
            cat20Contract.state = state;
            psbt.addContractOutput(
                cat20Contract,
                Postage.TOKEN_POSTAGE,
            );
        });
        psbt.change(mainAddress, 0);

        const signedPsbtHex = await testSigner.signPsbt(psbt.seal().toHex(), psbt.psbtOptions());
        psbt.combine(ExtPsbt.fromHex(signedPsbtHex)).finalizeAllInputs();
        expect(psbt.isFinalized).to.be.true;
    }
});
