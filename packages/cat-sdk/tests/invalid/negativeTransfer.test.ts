import { isLocalTest } from "../utils";
import { testProvider } from "../utils/testProvider";
import { createCat20, TestCAT20Generator } from "../utils/testCAT20Generator";
import { createCat721, TestCAT721Generator } from "../utils/testCAT721Generator";
import { ExtPsbt, fill, getBackTraceInfo, PubKey, Script, sha256, Signer, toByteString, toHex, Transaction, uint8ArrayToHex, UTXO } from "@opcat-labs/scrypt-ts-opcat";
import { testSigner } from "../utils/testSigner";
import { applyFixedArray, getDummyUtxo, toTokenOwnerAddress } from "../../src/utils";
import { CAT20, CAT20Guard, CAT20GuardStateLib, CAT20State, CAT20StateLib, CAT721, CAT721Guard, CAT721GuardStateLib, CAT721State, CAT721StateLib, ConstantsLib, OUTPUT_DATA_HASH_INDEX, TX_INPUT_COUNT_MAX, TX_OUTPUT_COUNT_MAX } from "../../src/contracts";
import { ContractPeripheral } from "../../src/utils/contractPeripheral";
import { Postage } from "../../src/typeConstants";
import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { loadAllArtifacts } from "../features/cat20/utils";
import { loadAllArtifacts as loadAllArtifacts721 } from "../features/cat721/utils";

use(chaiAsPromised)

isLocalTest(testProvider) && describe('Test negative transfer', () => {
    let cat20: TestCAT20Generator;
    let cat721: TestCAT721Generator;

    let mainAddress: string;
    let mainPubKey: PubKey
    let mainSigner: Signer

    before(async () => {
        loadAllArtifacts()
        loadAllArtifacts721()
        mainSigner = testSigner
        mainPubKey = PubKey(await testSigner.getPublicKey())
        mainAddress = await testSigner.getAddress()

        cat20 = (await createCat20([1n], toTokenOwnerAddress(mainAddress), 'c')).generator
        cat721 = (await createCat721('c', 1, toTokenOwnerAddress(mainAddress))).generator
    });
    describe('cat20', async () => {
        // usually, there cannot be a token utxo with amount <=0, but we still test it here for completeness
        it('success on input(100), output(100)', async () => {
            await testCat20([100n], [100n])
        })
        it('failed on input(100), output(200 - 100)', async () => {
            try {
                await testCat20([100n], [200n, -100n])
            } catch (error) {
                expect(error.message.includes('token amount is invalid')).to.be.true
            }
        })

        it('failed on input(100), output(100 + 0)', async () => {
            try {
                await testCat20([100n], [100n, 0n])
            } catch (error) {
                expect(error.message.includes('token amount is invalid')).to.be.true
            }
        })

        it('failed on input(-100), output(100 - 200)', async () => {
            try {
                await testCat20([-100n], [100n - 200n])
            } catch (error) {
                expect(error.message.includes('Execution failed')).to.be.true
            }
        })

        it('failed on input(200 - 100), output(100)', async () => {
            try {
                await testCat20([200n, -100n], [100n])
            } catch (error) {
                expect(error.message.includes('token amount should be non-negative')).to.be.true
            }
        })

    })
    describe('cat721', async () => {
        it('success on input(100), output(100)', async () => {
            await testCat721([100n], [100n])
        })
        // usually, there cannot be a nft utxo with localId < 0, but we still test it here for completeness
        it('failed on input(-1), output(-1)', async () => {
            try {
                await testCat721([-1n], [-1n])
            } catch (error) {
                expect(error.message.includes('localId should be non-negative')).to.be.true
            }
        })
    })

    async function testCat20(
        inputAmountList: bigint[],
        outputAmountList: bigint[],
    ) {
        const utxoList = await Promise.all(inputAmountList.map(fakeCAT20))

        const guardState = CAT20GuardStateLib.createEmptyState()

        // only 1 type token
        guardState.tokenScriptHashes[0] = ContractPeripheral.scriptHash(utxoList[0].utxo.script)
        guardState.tokenAmounts[0] = utxoList.reduce((acc, utxo) => acc + CAT20.deserializeState(utxo.utxo.data).amount, 0n)

        const outputStates: CAT20State[] = outputAmountList
            .map((amount) => ({
                ownerAddr: CAT20.deserializeState(utxoList[0].utxo.data).ownerAddr,
                amount,
            }))
        inputAmountList.forEach((_, i) => {
            guardState.tokenScriptIndexes[i] = 0n
        })
        const guard = new CAT20Guard()
        guard.state = guardState
        {
            const psbt = new ExtPsbt({ network: await testProvider.getNetwork(), maximumFeeRate: 1e8 }).spendUTXO(getDummyUtxo(mainAddress)).addContractOutput(guard, 1e8);
            const signedPsbtHex = await testSigner.signPsbt(psbt.seal().toHex(), psbt.psbtOptions());
            psbt.combine(ExtPsbt.fromHex(signedPsbtHex)).finalizeAllInputs();
        }

        const guardInputIndex = utxoList.length
        const psbt = new ExtPsbt({ network: await testProvider.getNetwork(), maximumFeeRate: 1e8 });
        utxoList.forEach((utxo, inputIndex) => {
            const cat20Contract = new CAT20(cat20.minterScriptHash, cat20.guardScriptHash, cat20.deployInfo.hasAdmin, cat20.deployInfo.adminScriptHash).bindToUtxo(utxo.utxo);
            psbt.addContractInput(cat20Contract, (contract, curPsbt) => {
                contract.unlock(
                    {
                        userPubKey: mainPubKey,
                        userSig: curPsbt.getSig(inputIndex, { address: mainAddress }),
                        spendScriptInputIndex: -1n,
                        spendType: 0n,
                    },
                    guardState,
                    BigInt(guardInputIndex),
                    getBackTraceInfo(utxoList[inputIndex].backtrace.prevTxHex, utxoList[inputIndex].backtrace.prevPrevTxHex, utxoList[inputIndex].backtrace.prevTxInput)
                )
            })
        })
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
                applyFixedArray(outputTokens, cat20OutputAmounts, cat20OutputStartIndex);

            }
            const tokenScriptIndexes = fill(-1n, TX_OUTPUT_COUNT_MAX);
            {
                const cat20ScriptOutputIndexes = outputStates.map(() => 0n);
                applyFixedArray(tokenScriptIndexes, cat20ScriptOutputIndexes, cat20OutputStartIndex);

            }

            const outputSatoshis = fill(0n, TX_OUTPUT_COUNT_MAX);
            {
                applyFixedArray(outputSatoshis, curPsbt.txOutputs.map((output) => BigInt(output.value)));
            }
            const cat20States = fill(CAT20StateLib.create(0n, toByteString('')), TX_INPUT_COUNT_MAX);
            {
                const inputCat20States = utxoList.map((utxo) => CAT20.deserializeState(utxo.utxo.data));
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
            )
        })
        outputStates.forEach((state) => {
            const cat20Contract = new CAT20(cat20.minterScriptHash, cat20.guardScriptHash, cat20.deployInfo.hasAdmin, cat20.deployInfo.adminScriptHash)
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

    async function testCat721(
        inputLocalIds: bigint[],
        outputLocalIds: bigint[],
    ) {
        const utxoList = await Promise.all(inputLocalIds.map(fakeCAT721))
        const guardState = CAT721GuardStateLib.createEmptyState()

        // only 1 type token
        guardState.nftScriptHashes[0] = ContractPeripheral.scriptHash(utxoList[0].utxo.script)
        utxoList.forEach((utxo, inputIndex) => {
            guardState.nftScriptIndexes[inputIndex] = BigInt(0)
        })

        const outputStates: CAT721State[] = outputLocalIds.map((localId) => {
            return {
                ownerAddr: CAT721.deserializeState(utxoList[0].utxo.data).ownerAddr,
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

        const guardInputIndex = utxoList.length
        const psbt = new ExtPsbt({
            network: await testProvider.getNetwork(),
            maximumFeeRate: 1e8,
        })
        utxoList.forEach((utxo, inputIndex) => {
            const cat721Contract = new CAT721(cat721.minterScriptHash, cat721.guardScriptHash).bindToUtxo(utxo.utxo);
            psbt.addContractInput(cat721Contract, (contract, curPsbt) => {
                contract.unlock(
                    {
                        userPubKey: mainPubKey,
                        userSig: curPsbt.getSig(inputIndex, { address: mainAddress }),
                        contractInputIndex: -1n,
                    },
                    guardState,
                    BigInt(guardInputIndex),
                    getBackTraceInfo(utxoList[inputIndex].backtrace.prevTxHex, utxoList[inputIndex].backtrace.prevPrevTxHex, utxoList[inputIndex].backtrace.prevTxInput),
                );
            });
        })

        const cat721OutputStartIndex = 0;
        const cat721InputStartIndex = 0;

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

                applyFixedArray(_outputLocalIds, outputLocalIds, cat721OutputStartIndex);
            }
            const nftScriptIndexes = fill(-1n, TX_OUTPUT_COUNT_MAX);
            {
                applyFixedArray(
                    nftScriptIndexes,
                    outputLocalIds.map(() => 0n),
                    cat721OutputStartIndex,
                );
            }
            const outputSatoshis = fill(0n, TX_OUTPUT_COUNT_MAX);
            {
                applyFixedArray(outputSatoshis, curPsbt.txOutputs.map((output) => BigInt(output.value)));
            }
            const cat721States = fill(CAT721StateLib.create(0n, toByteString('')), TX_INPUT_COUNT_MAX);
            {
                applyFixedArray(
                    cat721States,
                    utxoList.map((utxo) => CAT721StateLib.deserializeState(utxo.utxo.data)),
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
            const cat721Contract = new CAT721(cat721.minterScriptHash, cat721.guardScriptHash)
            cat721Contract.state = state;
            psbt.addContractOutput(cat721Contract, Postage.NFT_POSTAGE);
        });

        const signedPsbtHex = await testSigner.signPsbt(psbt.seal().toHex(), psbt.psbtOptions());
        psbt.combine(ExtPsbt.fromHex(signedPsbtHex)).finalizeAllInputs();
        expect(psbt.isFinalized).to.be.true;

    }

    async function fakeCAT20(amount: bigint) {
        const cat20State = CAT20StateLib.create(amount, toTokenOwnerAddress(mainAddress));
        const cat20Script = new CAT20(
            cat20.minterScriptHash,
            cat20.guardScriptHash,
            cat20.deployInfo.hasAdmin,
            cat20.deployInfo.adminScriptHash
        ).lockingScript.toHex()
        const dummyInputScript = Script.buildPublicKeyHashIn(mainPubKey, Buffer.from('304402203f92d9cc4a3cd5b736569cd4bac08a24e0610d60f48e89e396670c693f5638ee02204f732e6cfe50e6eae43ba6b8a76ccb34dec8a069b9afd922cd22531d0184cf4001', 'hex')).toHex()

        const prevPrevTx = new Transaction()
            .addInput(new Transaction.Input({
                prevTxId: getDummyUtxo().txId,
                outputIndex: 0,
                output: new Transaction.Output({
                    script: getDummyUtxo().script,
                    satoshis: 1e5,
                    data: ''
                }),
                script: dummyInputScript
            }))
            .addOutput(new Transaction.Output({
                script: cat20Script,
                satoshis: 1,
                data: CAT20StateLib.serializeState(cat20State)
            }))
        const prevTx = new Transaction()
            .addInput(new Transaction.Input({
                prevTxId: prevPrevTx.id,
                outputIndex: 0,
                output: prevPrevTx.outputs[0],
                script: dummyInputScript
            }))
            .addOutput(new Transaction.Output({
                script: cat20Script,
                satoshis: 1,
                data: CAT20StateLib.serializeState(cat20State)
            }))

        return {
            utxo: {
                txId: prevTx.id,
                outputIndex: 0,
                script: cat20Script,
                satoshis: 1,
                data: CAT20StateLib.serializeState(cat20State),
                txHashPreimage: toHex(prevTx.toTxHashPreimage())
            } as UTXO,
            backtrace: {
                prevTxHex: prevTx.toHex(),
                prevTxInput: 0,
                prevPrevTxHex: prevPrevTx.toHex()
            }
        }
    }
    async function fakeCAT721(localId: bigint) {
        const cat721State = CAT721StateLib.create(localId, toTokenOwnerAddress(mainAddress));
        const cat721Script = new CAT721(
            cat721.minterScriptHash,
            cat721.guardScriptHash
        ).lockingScript.toHex()
        const dummyInputScript = Script.buildPublicKeyHashIn(mainPubKey, Buffer.from('304402203f92d9cc4a3cd5b736569cd4bac08a24e0610d60f48e89e396670c693f5638ee02204f732e6cfe50e6eae43ba6b8a76ccb34dec8a069b9afd922cd22531d0184cf4001', 'hex')).toHex()

        const prevPrevTx = new Transaction()
            .addInput(new Transaction.Input({
                prevTxId: getDummyUtxo().txId,
                outputIndex: 0,
                output: new Transaction.Output({
                    script: getDummyUtxo().script,
                    satoshis: 1e5,
                    data: ''
                }),
                script: dummyInputScript
            }))
            .addOutput(new Transaction.Output({
                script: cat721Script,
                satoshis: 1,
                data: CAT721StateLib.serializeState(cat721State)
            }))
        const prevTx = new Transaction()
            .addInput(new Transaction.Input({
                prevTxId: prevPrevTx.id,
                outputIndex: 0,
                output: prevPrevTx.outputs[0],
                script: dummyInputScript
            }))
            .addOutput(new Transaction.Output({
                script: cat721Script,
                satoshis: 1,
                data: CAT721StateLib.serializeState(cat721State)
            }))

        return {
            utxo: {
                txId: prevTx.id,
                outputIndex: 0,
                script: cat721Script,
                satoshis: 1,
                data: CAT721StateLib.serializeState(cat721State),
                txHashPreimage: toHex(prevTx.toTxHashPreimage())
            } as UTXO,
            backtrace: {
                prevTxHex: prevTx.toHex(),
                prevTxInput: 0,
                prevPrevTxHex: prevPrevTx.toHex()
            }
        }
    }

})