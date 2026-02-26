import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { isLocalTest } from '../utils';
import { testProvider } from '../utils/testProvider';
import { loadAllArtifacts } from '../features/cat20/utils';
import { ExtPsbt, fill, getBackTraceInfo, PubKey, sha256, toByteString, toHex, uint8ArrayToHex, slice, intToByteString } from '@opcat-labs/scrypt-ts-opcat';
import { testSigner } from '../utils/testSigner';
import {createCat20, TestCat20} from '../utils/testCAT20Generator';
import { CAT20, CAT20State, CAT20StateLib, CAT20GuardStateLib, GUARD_TOKEN_TYPE_MAX, SpendType } from '../../src/contracts';
import { ContractPeripheral, CAT20GuardPeripheral } from '../../src/utils/contractPeripheral';
import { applyFixedArray, getDummyUtxo, toTokenOwnerAddress } from '../../src/utils';
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
        // F14 Fix: Get the raw pubkey string for guard signature
        const pubkey = await testSigner.getPublicKey()

        const outputStates: CAT20State[] = outputAmountList
            .filter((amount) => amount > 0n)
            .map((amount) => ({
                ownerAddr: CAT20.deserializeState(cat20.utxos[0].data).ownerAddr,
                amount,
            }));
        const outputHasCat20 = outputStates.length > 0;

        // For incorrectAmount tests, we need to manually create the guard with incorrect amounts
        // First get the txInputCountMax and txOutputCountMax by creating a dummy guard
        const totalInputAmount = cat20.utxos.reduce((acc, utxo) => acc + CAT20.deserializeState(utxo.data).amount, 0n);
        const totalOutputAmount = outputAmountList.reduce((acc, amount) => acc + amount, 0n);
        const totalBurnAmount = burnAmountList.reduce((acc, amount) => acc + amount, 0n);

        // Calculate transaction counts
        const receivers = totalInputAmount > 0n ? [{ address: CAT20.deserializeState(cat20.utxos[0].data).ownerAddr, amount: totalInputAmount, outputIndex: 0 }] : [];
        const txInputCount = cat20.utxos.length + 2;
        const txOutputCount = receivers.length + 1;

        // Create guard with correct structure (use input amount for now to pass validation)
        const guardOwnerAddr = toTokenOwnerAddress(mainAddress)
        const { guard, txInputCountMax, txOutputCountMax } = CAT20GuardPeripheral.createTransferGuard(
            cat20.utxos.map((utxo, index) => ({ token: utxo, inputIndex: index })),
            receivers,
            txInputCount,
            txOutputCount,
            guardOwnerAddr
        );

        // Now manually construct the guardState with incorrect amounts for testing
        const guardState = CAT20GuardStateLib.createEmptyState(txInputCountMax);
        // F14 Fix: Set deployer address (required)
        guardState.deployerAddr = guardOwnerAddr
        guardState.tokenScriptHashes[0] = ContractPeripheral.scriptHash(cat20.utxos[0].script);

        const tokenAmounts = fill(0n, GUARD_TOKEN_TYPE_MAX);
        tokenAmounts[0] = totalInputAmount;

        const tokenBurnAmounts = fill(0n, GUARD_TOKEN_TYPE_MAX);
        tokenBurnAmounts[0] = totalBurnAmount;

        // Build tokenScriptIndexes
        let tokenScriptIndexes = guardState.tokenScriptIndexes;
        for (let index = 0; index < cat20.utxos.length; index++) {
            const before = slice(tokenScriptIndexes, 0n, BigInt(index));
            const after = slice(tokenScriptIndexes, BigInt(index + 1));
            tokenScriptIndexes = before + intToByteString(0n, 1n) + after;
        }
        guardState.tokenScriptIndexes = tokenScriptIndexes;

        guard.state = guardState;
        {
            const psbt = new ExtPsbt({network: await testProvider.getNetwork(), maximumFeeRate: 1e8}).spendUTXO(getDummyUtxo(mainAddress)).addContractOutput(guard, 1e8);
            const signedPsbtHex = await testSigner.signPsbt(psbt.seal().toHex(), psbt.psbtOptions());
            psbt.combine(ExtPsbt.fromHex(signedPsbtHex)).finalizeAllInputs();
        }

        const guardInputIndex = cat20.utxos.length;
        const psbt = new ExtPsbt({network: await testProvider.getNetwork(), maximumFeeRate: 1e8});
        cat20.utxos.forEach((utxo, inputIndex) => {
            const cat20Contract = new CAT20(cat20.generator.minterScriptHash, cat20.generator.deployInfo.hasAdmin, cat20.generator.deployInfo.adminScriptHash).bindToUtxo(utxo);
            psbt.addContractInput(cat20Contract, (contract, curPsbt) => {
                contract.unlock(
                    {
                        userPubKey: mainPubKey,
                        userSig: curPsbt.getSig(inputIndex, { address: mainAddress }),
                        spendScriptInputIndex: -1n,
                        spendType: SpendType.UserSpend,
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
            const ownerAddrOrScripts = fill(toByteString(''), txOutputCountMax);
            {
                const outputScriptHashes = curPsbt.txOutputs
                    .map((output) => toByteString(sha256(uint8ArrayToHex(output.script))));
                applyFixedArray(ownerAddrOrScripts, outputScriptHashes, cat20OutputStartIndex);
                const cat20OwnerAddrs = outputStates.map((state) => state.ownerAddr);
                applyFixedArray(ownerAddrOrScripts, cat20OwnerAddrs, cat20OutputStartIndex);
            }

            const outputTokens = fill(0n, txOutputCountMax);
            {
                const cat20OutputAmounts = outputStates.map((state) => state.amount);
                if (outputHasCat20) {
                    applyFixedArray(outputTokens, cat20OutputAmounts, cat20OutputStartIndex);
                }
            }

            const tokenScriptIndexes = fill(-1n, txOutputCountMax);
            {
                const cat20ScriptOutputIndexes = outputStates.map(() => 0n);
                if (outputHasCat20) {
                    applyFixedArray(tokenScriptIndexes, cat20ScriptOutputIndexes, cat20OutputStartIndex);
                }
            }

            const outputSatoshis = fill(0n, txOutputCountMax);
            {
                applyFixedArray(outputSatoshis, curPsbt.txOutputs.map((output) => BigInt(output.value)));
            }
            const cat20States = fill(CAT20StateLib.create(0n, toByteString('')), txInputCountMax);
            {
                const inputCat20States = cat20.utxos.map((utxo) => CAT20.deserializeState(utxo.data));
                applyFixedArray(cat20States, inputCat20States, cat20InputStartIndex);
            }
            const outputCount = curPsbt.txOutputs.length;
            const nextStateHashes = fill(toByteString(''), txOutputCountMax)
            applyFixedArray(
              nextStateHashes,
              curPsbt.txOutputs.map((output) => sha256(toHex(output.data)))
            )

            // F14 Fix: Get deployer signature for guard
            const deployerSig = curPsbt.getSig(guardInputIndex, { publicKey: pubkey })

            contract.unlock(
                deployerSig,
                PubKey(pubkey),
                tokenAmounts,
                tokenBurnAmounts,
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
            const cat20Contract = new CAT20(cat20.generator.minterScriptHash, cat20.generator.deployInfo.hasAdmin, cat20.generator.deployInfo.adminScriptHash)
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
