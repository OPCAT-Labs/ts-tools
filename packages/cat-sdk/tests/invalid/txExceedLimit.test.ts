import { ExtPsbt, fill, getBackTraceInfo, PubKey, sha256, toByteString, toHex, uint8ArrayToHex } from "@opcat-labs/scrypt-ts-opcat";
import { loadAllArtifacts } from "../features/cat20/utils";
import { createCat20, TestCat20 } from "../utils/testCAT20Generator";
import { testSigner } from "../utils/testSigner";
import { CAT20, CAT20Guard, CAT20GuardStateLib, CAT20State, CAT20StateLib, ConstantsLib, TX_INPUT_COUNT_MAX, TX_OUTPUT_COUNT_MAX } from "../../src/contracts";
import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';

import { ContractPeripheral } from '../../src/utils/contractPeripheral';
import { applyFixedArray, getDummyUtxo } from '../../src/utils';
import { Postage } from '../../src/typeConstants';
import { testProvider } from "../utils/testProvider";
import { isLocalTest } from "../utils";
use(chaiAsPromised)

isLocalTest(testProvider) && describe('Test ExtPsbt inputCount/outputCount exceed limit', () => {
    let mainAddress: string;
    let mainPubKey: PubKey

    before(async () => {
        loadAllArtifacts();
        mainAddress = await testSigner.getAddress();
        mainPubKey = PubKey(await testSigner.getPublicKey());
    });

    it('should succeed inputCount exceed limit, but token inputs not exceed limit', async () => {
        const cat20 = await createCat20([1000n], mainAddress, 'test');
        const callback = (psbt: ExtPsbt) => {
            const inputsToAdd = TX_INPUT_COUNT_MAX + 1 - psbt.txInputs.length;
            for (let i = 0; i < inputsToAdd; i++) {
                psbt.spendUTXO(getDummyUtxo(mainAddress));
            }
        }
        await testCase(cat20, callback);
    });

    it('should fail inputCount exceed limit, but and inputs exceed limit', async () => {
        const cat20 = await createCat20(new Array(TX_INPUT_COUNT_MAX + 1).fill(1000n), mainAddress, 'test');
        const callback = (psbt: ExtPsbt) => {
            const inputsToAdd = TX_INPUT_COUNT_MAX + 1 - psbt.txInputs.length;
            for (let i = 0; i < inputsToAdd; i++) {
                psbt.spendUTXO(getDummyUtxo(mainAddress));
            }
        }
        try {
            await testCase(cat20, callback);
        } catch (error) {
            expect(error.message).to.equal('Execution failed, token script hash is invalid');
        }
    });

    it('should fail outputCount exceed limit', async () => {
        const cat20 = await createCat20([1000n], mainAddress, 'test');
        const callback = (psbt: ExtPsbt) => {
            const outputsToAdd = TX_OUTPUT_COUNT_MAX + 1 - psbt.txOutputs.length;
            for (let i = 0; i < outputsToAdd; i++) {
                psbt.addOutput({ address: mainAddress, value: 1000n, data: new Uint8Array() });
            }
        }
        try {
            await testCase(cat20, callback);
        } catch (error) {
            expect(error.message).to.equal('Execution failed, output count is invalid');
        }
    });

    it('should succeed when inputCount equals limit', async () => {
        const cat20 = await createCat20([1000n], mainAddress, 'test');
        const callback = (psbt: ExtPsbt) => {
            const inputsToAdd = TX_INPUT_COUNT_MAX - psbt.txInputs.length;
            for (let i = 0; i < inputsToAdd; i++) {
                psbt.spendUTXO(getDummyUtxo(mainAddress));
            }
        }

        await testCase(cat20, callback);
    });

    it('should succeed when outputCount equals limit', async () => {
        const cat20 = await createCat20([1000n], mainAddress, 'test');
        const callback = (psbt: ExtPsbt) => {
            const outputsToAdd = TX_OUTPUT_COUNT_MAX - psbt.txOutputs.length;
            for (let i = 0; i < outputsToAdd; i++) {
                psbt.addOutput({ address: mainAddress, value: 1000n, data: new Uint8Array() });
            }
        }

        await testCase(cat20, callback);
    });


    async function testCase(cat20: TestCat20, callback: (psbt: ExtPsbt) => void) {
        const guardState = CAT20GuardStateLib.createEmptyState();
        guardState.tokenScriptHashes[0] = ContractPeripheral.scriptHash(cat20.utxos[0].script);
        guardState.tokenAmounts[0] = cat20.utxos.reduce((acc, utxo) => acc + CAT20StateLib.deserializeState(utxo.data).amount, 0n);
        guardState.tokenBurnAmounts[0] = 0n
        const outputAmountList: bigint[] = [guardState.tokenAmounts[0]];
        const outputStates: CAT20State[] = outputAmountList.map((amount) => ({
            tag: ConstantsLib.OPCAT_CAT20_TAG,
            ownerAddr: CAT20StateLib.deserializeState(cat20.utxos[0].data).ownerAddr,
            amount,
        }));
        const outputHasCat20 = outputStates.length > 0;

        cat20.utxos.forEach((utxo, i) => {
            i < TX_INPUT_COUNT_MAX && (guardState.tokenScriptIndexes[i] = 0n);
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
        callback(psbt);
        
        const signedPsbtHex = await testSigner.signPsbt(psbt.seal().toHex(), psbt.psbtOptions());
        psbt.combine(ExtPsbt.fromHex(signedPsbtHex)).finalizeAllInputs();
        expect(psbt.isFinalized).to.be.true;
    }
});
