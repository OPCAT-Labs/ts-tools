import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { isLocalTest } from './utils';
import { testProvider } from './utils/testProvider';
import { loadAllArtifacts } from './features/cat20/utils';
import { loadAllArtifacts as loadAllArtifacts721} from './features/cat721/utils';
import { ExtPsbt, fill, getBackTraceInfo, PubKey, sha256, toByteString, toHex, uint8ArrayToHex, UTXO } from '@opcat-labs/scrypt-ts-opcat';
import { testSigner } from './utils/testSigner';
import {createCat20, TestCat20, TestCAT20Generator} from './utils/testCAT20Generator';
import { CAT20, CAT20Guard, CAT20GuardConstState, CAT20GuardStateLib, CAT20State, CAT20StateLib, CAT721, CAT721Guard, CAT721GuardConstState, CAT721GuardStateLib, CAT721StateLib, ConstantsLib, TX_INPUT_COUNT_MAX, TX_OUTPUT_COUNT_MAX } from '../src/contracts';
import { ContractPeripheral } from '../src/utils/contractPeripheral';
import { applyFixedArray, getDummyUtxo } from '../src/utils';
import { Postage } from '../src/typeConstants';
import { createCat721, TestCAT721Generator } from './utils/testCAT721Generator';
use(chaiAsPromised)




/**
 * test multiple cat20 & cat721 token types transfer/burn in a single txn
 */

isLocalTest(testProvider) && describe('Test multiple cat20 & cat721 token types transfer/burn in a single txn', () => {
    let mainAddress: string;
    let mainPubKey: PubKey

    let cat20_1: Cat20;
    let cat20_2: Cat20;
    let cat20_3: Cat20;

    let cat721_1: Cat721;
    let cat721_2: Cat721;
    let cat721_3: Cat721;

    before(async () => {
        loadAllArtifacts();
        loadAllArtifacts721()
        mainAddress = await testSigner.getAddress();
        mainPubKey = PubKey(await testSigner.getPublicKey());
        cat20_1 = await _createCat20(1000n, '1');
        cat20_2 = await _createCat20(2000n, '2');
        cat20_3 = await _createCat20(3000n, '3');

        cat721_1 = await _createCat721('1');
        cat721_2 = await _createCat721('2');
        cat721_3 = await _createCat721('3');
    });

    it('txn should be success when send 2 types of cat20 tokens in a single txn', async () => {
        await TestCase.create().addCat20(cat20_1, 1000n, 0n).addCat20(cat20_2, 2000n, 0n).test();
    });
    it('txn should be success when send 2 types of cat721 tokens in a single txn', async () => {
        await TestCase.create().addCat721(cat721_1, false).addCat721(cat721_2, false).test();
    });
    it('txn should be success when send 1 type of cat20 & 1 type of cat721 tokens in a single txn', async () => {
        await TestCase.create().addCat20(cat20_1, 1000n, 0n).addCat721(cat721_1, false).test();
    });

    it('txn should be success when send 3 types of cat20 tokens and burn one of them in a single txn', async () => {
        await TestCase.create()
            .addCat20(cat20_1, 1000n, 0n)
            // full burn cat20_2
            .addCat20(cat20_2, 0n, 2000n)
            .addCat20(cat20_3, 3000n, 0n)
            .test();

        await TestCase.create()
            .addCat20(cat20_1, 1000n, 0n)
            // partial burn cat20_2
            .addCat20(cat20_2, 1000n, 1000n)
            .addCat20(cat20_3, 3000n, 0n)
            .test();
    });
    it('txn should be success when send 3 types of cat721 tokens and burn one of them in a single txn', async () => {
        await TestCase.create().addCat721(cat721_1, false).addCat721(cat721_2, true).addCat721(cat721_3, false).test();
    });
    it('txn should be success when send 2 types of cat20 tokens, 2 type of cat721 tokens, and burn one of them in a single txn', async () => {
        await TestCase.create()
            .addCat20(cat20_1, 1000n, 0n)
            // full burn cat20_2
            .addCat20(cat20_2, 0n, 2000n)
            .addCat721(cat721_1, false)
            .addCat721(cat721_2, true)
            .test();

        await TestCase.create()
            .addCat20(cat20_1, 1000n, 0n)
            // partial burn cat20_2
            .addCat20(cat20_2, 1000n, 1000n)
            .addCat721(cat721_1, false)
            .addCat721(cat721_2, true)
            .test();
    });

    async function _createCat20(amount: bigint, symbol: string): Promise<Cat20> {
        const res = await createCat20([amount], mainAddress, symbol);
        return {
            generater: res.generator,
            utxo: res.utxos[0],
            trace: res.utxoTraces[0],
        };
    }

    async function _createCat721(symbol: string): Promise<Cat721> {
        const res = await createCat721(symbol, 1, mainAddress);
        return {
            generater: res.generator,
            utxo: res.utxos[0],
            trace: res.utxoTraces[0],
        };
    }

    type Cat20 = {
        generater: TestCAT20Generator;  
        utxo: UTXO;
        trace: {
            prevTxHex: string;
            prevTxInput: number;
            prevPrevTxHex: string;
        };
    };
    type Cat721 = {
        generater: TestCAT721Generator;
        utxo: UTXO;
        trace: {
            prevTxHex: string;
            prevTxInput: number;
            prevPrevTxHex: string;
        };
    };
    class TestCase {
        cat20s: Array<{ cat20: Cat20; sendAmount: bigint; burnAmount: bigint }> = [];
        cat721s: Array<{ cat721: Cat721; isBurn: boolean }> = [];
        psbt: ExtPsbt;

        private tested = false;

        static create() {
            return new TestCase();
        }

        private static async createCat20GuardContract(guardState: CAT20GuardConstState) {
            const guard = new CAT20Guard();
            guard.state = guardState;
            const psbt = new ExtPsbt({network: await testProvider.getNetwork(), maximumFeeRate: 1e8})
                .spendUTXO(getDummyUtxo(mainAddress))
                // 1e8 is enough for the next txn's fee
                .addContractOutput(guard, 1e8)
                .seal();
            const signedPsbtHex = await testSigner.signPsbt(psbt.seal().toHex(), psbt.psbtOptions());
            psbt.combine(ExtPsbt.fromHex(signedPsbtHex)).finalizeAllInputs();
            return guard;
        }

        private static async createCat721GuardContract(guardState: CAT721GuardConstState) {
            const guard = new CAT721Guard();
            guard.state = guardState;
            const psbt = new ExtPsbt({network: await testProvider.getNetwork(), maximumFeeRate: 1e8})
                .spendUTXO(getDummyUtxo(mainAddress))
                // 1e8 is enough for the next txn's fee
                .addContractOutput(guard, 1e8)
                .seal();
            const signedPsbtHex = await testSigner.signPsbt(psbt.seal().toHex(), psbt.psbtOptions());
            psbt.combine(ExtPsbt.fromHex(signedPsbtHex)).finalizeAllInputs();
            return guard;
        }

        addCat20(cat20: Cat20, sendAmount: bigint, burnAmount: bigint) {
            this.cat20s.push({ cat20, sendAmount, burnAmount });
            return this;
        }

        addCat721(cat721: Cat721, isBurn: boolean) {
            this.cat721s.push({ cat721, isBurn });
            return this;
        }

        async test() {
            if (this.tested) {
                throw new Error('TestCase already tested');
            }
            this.tested = true;

            const psbt = new ExtPsbt({network: await testProvider.getNetwork(), maximumFeeRate: 1e8});

            const cat20GuardState = CAT20GuardStateLib.createEmptyState();
            const cat721GuardState = CAT721GuardStateLib.createEmptyState();

            const hasCat20 = this.cat20s.length > 0;
            const hasCat721 = this.cat721s.length > 0;

            let inputIndex = 0;
            let cat20GuardInputIndex = -1;
            let cat721GuardInputIndex = -1;
            // first output is state hash root output
            let outputIndex = 0;
            const cat20OutputStartIndex = 0;
            const cat20InputStartIndex = 0;
            let cat721OutputStartIndex = -1;
            let cat721InputStartIndex = -1;
            // let cat20ScriptInputIndexes: Int32[] = [];
            const cat20ScriptOutputIndexes: bigint[] = [];
            // let cat721ScriptInputIndexes: Int32[] = [];
            const cat721ScriptOutputIndexes: bigint[] = [];
            if (hasCat20) {
                this.cat20s.forEach(({ cat20, sendAmount, burnAmount }, index) => {
                    cat20GuardState.tokenScriptHashes[index] = ContractPeripheral.scriptHash(cat20.utxo.script);
                    cat20GuardState.tokenAmounts[index] = CAT20.deserializeState(cat20.utxo.data).amount;
                    cat20GuardState.tokenBurnAmounts[index] = burnAmount;
                    cat20GuardState.tokenScriptIndexes[inputIndex] = BigInt(index);

                    const contract = new CAT20(
                        cat20.generater.minterScriptHash,
                        cat20.generater.guardScriptHash,
                        cat20.generater.deployInfo.hasAdmin,
                        cat20.generater.deployInfo.adminScriptHash
                    ).bindToUtxo(cat20.utxo);
                    psbt.addContractInput(contract, (contract, curPsbt) => {
                        const localInputIndex = cat20InputStartIndex + index
                        contract.unlock(
                            {
                                userPubKey: mainPubKey,
                                userSig: curPsbt.getSig(localInputIndex, { address: mainAddress }),
                                spendScriptInputIndex: -1n,
                                spendType: 0n,
                            },
                            cat20GuardState,
                            BigInt(cat20GuardInputIndex),
                            getBackTraceInfo(
                                cat20.trace.prevTxHex,
                                cat20.trace.prevPrevTxHex,
                                cat20.trace.prevTxInput,
                            ),
                        );
                    });

                    // cat20ScriptInputIndexes.push(BigInt(index));
                    if (sendAmount > 0n) {
                        // transfer to main address
                        const cat20Contract = new CAT20(
                            cat20.generater.minterScriptHash,
                            cat20.generater.guardScriptHash,
                            cat20.generater.deployInfo.hasAdmin,
                            cat20.generater.deployInfo.adminScriptHash
                        ).bindToUtxo(cat20.utxo);
                        cat20Contract.state = {
                            ownerAddr: CAT20.deserializeState(cat20.utxo.data).ownerAddr,
                            amount: sendAmount,
                        };
                        psbt.addContractOutput(cat20Contract, Postage.TOKEN_POSTAGE);
                        cat20ScriptOutputIndexes.push(BigInt(index));
                        outputIndex++;
                    }

                    inputIndex++;
                });

                cat20GuardInputIndex = inputIndex++;
                const guardCovenant = await TestCase.createCat20GuardContract(cat20GuardState);
                psbt.addContractInput(guardCovenant, (contract, curPsbt) => {
                    const ownerAddrOrScripts = fill(toByteString(''), TX_OUTPUT_COUNT_MAX);
                    {
                        const outputScriptHashes = curPsbt.txOutputs
                            .map((output) => toByteString(sha256(uint8ArrayToHex(output.script))));
                        applyFixedArray(ownerAddrOrScripts, outputScriptHashes, cat20OutputStartIndex);
                        const cat20OwnerAddrs = this.cat20s
                            .filter(({ sendAmount }) => sendAmount > 0n)
                            .map(({ cat20 }) => CAT20.deserializeState(cat20.utxo.data).ownerAddr);
                        applyFixedArray(ownerAddrOrScripts, cat20OwnerAddrs, cat20OutputStartIndex);
                    }

                    const outputTokens = fill(0n, TX_OUTPUT_COUNT_MAX);
                    {
                        const cat20OutputAmounts = this.cat20s
                            .filter(({ sendAmount }) => sendAmount > 0n)
                            .map(({ sendAmount }) => sendAmount)
                        applyFixedArray(outputTokens, cat20OutputAmounts, cat20OutputStartIndex);
                    }

                    const tokenScriptIndexes = fill(-1n, TX_OUTPUT_COUNT_MAX);
                    {
                        applyFixedArray(tokenScriptIndexes, cat20ScriptOutputIndexes, cat20OutputStartIndex);
                    }

                    const outputSatoshis = fill(0n, TX_OUTPUT_COUNT_MAX);
                    {
                        applyFixedArray(outputSatoshis, curPsbt.txOutputs.map((output) => BigInt(output.value)));
                    }
                    const cat20States = fill(CAT20StateLib.create(0n, toByteString('')), TX_INPUT_COUNT_MAX);
                    {
                        const inputCat20States = this.cat20s.map(({ cat20 }) => CAT20.deserializeState(cat20.utxo.data));
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
            }
            if (hasCat721) {
                cat721InputStartIndex = inputIndex;
                cat721OutputStartIndex = outputIndex;
                this.cat721s.forEach(({ cat721, isBurn }, index) => {
                    cat721GuardState.nftScriptHashes[index] = ContractPeripheral.scriptHash(cat721.utxo.script);
                    cat721GuardState.nftBurnMasks[inputIndex] = isBurn;
                    cat721GuardState.nftScriptIndexes[inputIndex] = BigInt(index);

                    inputIndex++;

                    const cat721Contract = new CAT721(cat721.generater.minterScriptHash, cat721.generater.guardScriptHash).bindToUtxo(cat721.utxo);
                    psbt.addContractInput(cat721Contract, (contract, curPsbt) => {
                        const localInputIndex = cat721InputStartIndex + index
                        contract.unlock(
                            {
                                userPubKey: mainPubKey,
                                userSig: curPsbt.getSig(localInputIndex, { address: mainAddress }),
                                contractInputIndex: -1n,
                            },
                            cat721GuardState,
                            BigInt(cat721GuardInputIndex),
                            getBackTraceInfo(
                                cat721.trace.prevTxHex,
                                cat721.trace.prevPrevTxHex,
                                cat721.trace.prevTxInput,
                            ),
                        );
                    });
                    if (!isBurn) {
                        // transfer to main address
                        const cat721Contract = new CAT721(cat721.generater.minterScriptHash, cat721.generater.guardScriptHash).bindToUtxo(cat721.utxo);
                        cat721Contract.state = {
                            ownerAddr: CAT721.deserializeState(cat721.utxo.data).ownerAddr,
                            localId: CAT721.deserializeState(cat721.utxo.data).localId,
                        };
                        psbt.addContractOutput(cat721Contract, Postage.NFT_POSTAGE);
                        cat721ScriptOutputIndexes.push(BigInt(index));
                        outputIndex++;
                    }
                });

                cat721GuardInputIndex = inputIndex++;
                const guard = await TestCase.createCat721GuardContract(cat721GuardState);
                psbt.addContractInput(guard, (contract, curPsbt) => {
                    const ownerAddrOrScripts = fill(toByteString(''), TX_OUTPUT_COUNT_MAX);
                    {
                        const outputScriptHashes = curPsbt.txOutputs
                            .map((output) => toByteString(sha256(uint8ArrayToHex(output.script))));
                        applyFixedArray(ownerAddrOrScripts, outputScriptHashes, 0);
                        const cat721OwnerAddrs = this.cat721s
                            .filter(({ isBurn }) => !isBurn)
                            .map(({ cat721 }) => CAT721.deserializeState(cat721.utxo.data).ownerAddr);
                        applyFixedArray(ownerAddrOrScripts, cat721OwnerAddrs, cat721OutputStartIndex);
                    }
                    const _outputLocalIds = fill(-1n, TX_OUTPUT_COUNT_MAX);
                    {
                        const outputLocalIds = this.cat721s
                            .filter(({ isBurn }) => !isBurn)
                            .map(({ cat721 }) => CAT721.deserializeState(cat721.utxo.data).localId);
                        applyFixedArray(_outputLocalIds, outputLocalIds, 0);
                    }
                    const nftScriptIndexes = fill(-1n, TX_OUTPUT_COUNT_MAX);
                    {
                        applyFixedArray(nftScriptIndexes, cat721ScriptOutputIndexes, cat721OutputStartIndex)
                    }
                    const outputSatoshis = fill(0n, TX_OUTPUT_COUNT_MAX);
                    {
                        applyFixedArray(outputSatoshis, curPsbt.txOutputs.map((output) => BigInt(output.value)));
                    }
                    const cat721States = fill(CAT721StateLib.create(0n, toByteString('')), TX_INPUT_COUNT_MAX);
                    {
                        const inputCat721States = this.cat721s.map(({ cat721 }) => CAT721.deserializeState(cat721.utxo.data));
                        applyFixedArray(
                            cat721States,
                            inputCat721States,
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
            }

            const signedPsbtHex = await testSigner.signPsbt(psbt.seal().toHex(), psbt.psbtOptions());
            psbt.combine(ExtPsbt.fromHex(signedPsbtHex)).finalizeAllInputs();
            expect(psbt.isFinalized).to.be.true;
        }
    }
});
