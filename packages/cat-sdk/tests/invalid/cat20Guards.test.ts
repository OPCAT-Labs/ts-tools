import { isLocalTest } from "../utils";
import { testProvider } from "../utils/testProvider";
import { loadAllArtifacts } from "../features/cat20/utils";
import { createCat20 } from "../utils/testCAT20Generator";
import { testSigner } from "../utils/testSigner";
import { CAT20StateLib } from "../../src/contracts";
import { use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { multiSendTokens, MultiTokenTransferInfo } from '../utils/testCAT20/features/multiSend';
import { Script } from '@opcat-labs/opcat';

use(chaiAsPromised);

// Helper function to get a random value between min (inclusive) and max (exclusive)
// Similar to array.slice(min, max) behavior
function getRandom(min: number, max: number): number {
    if (max <= min) {
        throw new Error(`getRandom: max (${max}) must be greater than min (${min})`);
    }
    return min + Math.floor(Math.random() * (max - min));
}

// Generate representative valid test combinations based on constraints
// Strategy: Test boundary values (min, max) and one random middle value to ensure good coverage with minimal tests
function generateValidCombinations(
    txiValues: number[] = [],
    tokenInValues: number[] = [],
    txoValues: number[] = [],
    tokenOutValues: number[] = [],
    tokenTypeValues: number[] = []
) {
    const combinations: Array<{txi: number, tokenIn: number, txo: number, tokenOut: number, tokenType: number}> = [];

    // Constraints: txi<=6, tokenIn>0, tokenIn<txi, tokenIn>=tokenType, txo>=tokenOut, tokenOut>=0, tokenType>=1, tokenType<=2

    for (const txi of txiValues) {
        for (const tokenIn of tokenInValues) {
            // Skip if tokenIn >= txi (must satisfy: tokenIn < txi)
            if (tokenIn >= txi) continue;

            for (const txo of txoValues) {
                for (const tokenOut of tokenOutValues) {
                    // Skip if tokenOut > txo (must satisfy: tokenOut <= txo)
                    if (tokenOut > txo) continue;

                    for (const tokenType of tokenTypeValues) {
                        // Skip if tokenIn < tokenType (must satisfy: tokenIn >= tokenType)
                        if (tokenIn < tokenType) continue;

                        combinations.push({ txi, tokenIn, txo, tokenOut, tokenType });
                    }
                }
            }
        }
    }

    return combinations;
}


isLocalTest(testProvider) && describe('Test cat20Guard_6_6_2', () => {
    let mainAddress: string;

    let type1Cat20: Awaited<ReturnType<typeof createCat20>>;
    let type2Cat20: Awaited<ReturnType<typeof createCat20>>;
    let type3Cat20: Awaited<ReturnType<typeof createCat20>>;
    let type4Cat20: Awaited<ReturnType<typeof createCat20>>;

    before(async () => {
        loadAllArtifacts();
        mainAddress = await testSigner.getAddress();

        // Prepare CAT20 tokens using testCat20Generator
        // Each type should prepare 12 UTXOs for testing
        // Create 12 UTXOs with 1000n tokens each
        const tokenAmounts = new Array(12).fill(1000n);

        // Create 4 different types of tokens
        type1Cat20 = await createCat20(tokenAmounts, mainAddress, 'type1');
        type2Cat20 = await createCat20(tokenAmounts, mainAddress, 'type2');
        type3Cat20 = await createCat20(tokenAmounts, mainAddress, 'type3');
        type4Cat20 = await createCat20(tokenAmounts, mainAddress, 'type4');
    });

    // Shared transfer function for all test cases
    async function transfer(
        txi: number,
        tokenIn: number,
        txo: number,
        tokenOut: number,
        tokenType: number,
        guardTokenTypeCapacity: number,
        maxInputCount: number,
        maxOutputCount: number
    ) {
        // Distribute tokenIn UTXOs across tokenType types
        const utxosPerType = Math.floor(tokenIn / tokenType);
        const extraUtxos = tokenIn % tokenType;

        const type1TokenUtxos = tokenType >= 1
            ? type1Cat20.utxos.slice(0, utxosPerType + (0 < extraUtxos ? 1 : 0))
            : [];
        const type2TokenUtxos = tokenType >= 2
            ? type2Cat20.utxos.slice(0, utxosPerType + (1 < extraUtxos ? 1 : 0))
            : [];
        const type3TokenUtxos = tokenType >= 3
            ? type3Cat20.utxos.slice(0, utxosPerType + (2 < extraUtxos ? 1 : 0))
            : [];
        const type4TokenUtxos = tokenType >= 4
            ? type4Cat20.utxos.slice(0, utxosPerType + (3 < extraUtxos ? 1 : 0))
            : [];

        // Calculate total input amount for each type
        const type1InputAmount = type1TokenUtxos.reduce((acc, utxo) =>
            acc + CAT20StateLib.deserializeState(utxo.data).amount, 0n);
        const type2InputAmount = type2TokenUtxos.reduce((acc, utxo) =>
            acc + CAT20StateLib.deserializeState(utxo.data).amount, 0n);
        const type3InputAmount = type3TokenUtxos.reduce((acc, utxo) =>
            acc + CAT20StateLib.deserializeState(utxo.data).amount, 0n);
        const type4InputAmount = type4TokenUtxos.reduce((acc, utxo) =>
            acc + CAT20StateLib.deserializeState(utxo.data).amount, 0n);

        // Distribute tokenOut receivers across tokenType types
        const outputsPerType = Math.floor(tokenOut / tokenType);
        const extraOutputs = tokenOut % tokenType;

        // Get owner address in hex format
        const ownerAddrHex = CAT20StateLib.deserializeState(type1Cat20.utxos[0].data).ownerAddr;

        // Create receivers for each token type
        const type1TokenReceivers = tokenType >= 1 && outputsPerType + (0 < extraOutputs ? 1 : 0) > 0
            ? new Array(outputsPerType + (0 < extraOutputs ? 1 : 0)).fill(null).map(() => ({
                address: ownerAddrHex,
                amount: type1InputAmount / BigInt(outputsPerType + (0 < extraOutputs ? 1 : 0))
            }))
            : [];

        const type2TokenReceivers = tokenType >= 2 && outputsPerType + (1 < extraOutputs ? 1 : 0) > 0
            ? new Array(outputsPerType + (1 < extraOutputs ? 1 : 0)).fill(null).map(() => ({
                address: ownerAddrHex,
                amount: type2InputAmount / BigInt(outputsPerType + (1 < extraOutputs ? 1 : 0))
            }))
            : [];

        const type3TokenReceivers = tokenType >= 3 && outputsPerType + (2 < extraOutputs ? 1 : 0) > 0
            ? new Array(outputsPerType + (2 < extraOutputs ? 1 : 0)).fill(null).map(() => ({
                address: ownerAddrHex,
                amount: type3InputAmount / BigInt(outputsPerType + (2 < extraOutputs ? 1 : 0))
            }))
            : [];

        const type4TokenReceivers = tokenType >= 4 && outputsPerType + (3 < extraOutputs ? 1 : 0) > 0
            ? new Array(outputsPerType + (3 < extraOutputs ? 1 : 0)).fill(null).map(() => ({
                address: ownerAddrHex,
                amount: type4InputAmount / BigInt(outputsPerType + (3 < extraOutputs ? 1 : 0))
            }))
            : [];

        // Build MultiTokenTransferInfo
        const tokens: MultiTokenTransferInfo = {
            type1: {
                inputUtxos: type1TokenUtxos,
                receivers: type1TokenReceivers,
                minterScriptHash: type1Cat20.generator.minterScriptHash,
                hasAdmin: type1Cat20.generator.deployInfo.hasAdmin,
                adminScriptHash: type1Cat20.generator.deployInfo.adminScriptHash,
            }
        };

        if (tokenType >= 2) {
            tokens.type2 = {
                inputUtxos: type2TokenUtxos,
                receivers: type2TokenReceivers,
                minterScriptHash: type2Cat20.generator.minterScriptHash,
                hasAdmin: type2Cat20.generator.deployInfo.hasAdmin,
                adminScriptHash: type2Cat20.generator.deployInfo.adminScriptHash,
            };
        }

        if (tokenType >= 3) {
            tokens.type3 = {
                inputUtxos: type3TokenUtxos,
                receivers: type3TokenReceivers,
                minterScriptHash: type3Cat20.generator.minterScriptHash,
                hasAdmin: type3Cat20.generator.deployInfo.hasAdmin,
                adminScriptHash: type3Cat20.generator.deployInfo.adminScriptHash,
            };
        }

        if (tokenType >= 4) {
            tokens.type4 = {
                inputUtxos: type4TokenUtxos,
                receivers: type4TokenReceivers,
                minterScriptHash: type4Cat20.generator.minterScriptHash,
                hasAdmin: type4Cat20.generator.deployInfo.hasAdmin,
                adminScriptHash: type4Cat20.generator.deployInfo.adminScriptHash,
            };
        }

        // Calculate actual input/output counts
        const actualTokenInputCount = type1TokenUtxos.length + type2TokenUtxos.length +
                                     type3TokenUtxos.length + type4TokenUtxos.length;
        const actualTokenOutputCount = type1TokenReceivers.length + type2TokenReceivers.length +
                                      type3TokenReceivers.length + type4TokenReceivers.length;

        // Calculate if we need fee input and change output
        // txi = actualTokenInputCount + guardInput + feeInput + p2pkhInputs
        // txo = actualTokenOutputCount + changeOutput + feeOutputs
        const canAddFeeInput = txi > actualTokenInputCount + 1; // +1 for guard
        const canAddChangeOutput = txo > actualTokenOutputCount;

        // Only add fee input if we can also add a change output (to avoid wasting satoshis as fees)
        const needFeeInput = canAddFeeInput && canAddChangeOutput;
        const needFeeChangeOutput = canAddChangeOutput;

        // Calculate how many extra p2pkh inputs and fee outputs we need
        const currentInputCount = actualTokenInputCount + 1 + (needFeeInput ? 1 : 0); // token + guard + fee
        // Only add p2pkh inputs if we have output space for their satoshis
        const needP2pkhInputs = canAddChangeOutput ? Math.max(0, txi - currentInputCount) : 0;

        const currentOutputCount = actualTokenOutputCount + (needFeeChangeOutput ? 1 : 0); // token + change
        const needFeeOutputs = Math.max(0, txo - currentOutputCount);

        // When there's no fee input, the guard UTXO needs to have enough satoshis to pay fees
        // Also account for extra p2pkh inputs and outputs that will be added
        // Estimate: ~10000 satoshis per input/output should be enough for most transactions
        const guardDustLimit = needFeeInput
            ? undefined
            : BigInt((actualTokenInputCount + actualTokenOutputCount + needP2pkhInputs + needFeeOutputs + 2) * 10000);

        // Get fee UTXOs for p2pkh inputs
        let feeUtxos = await testProvider.getUtxos(mainAddress);
        const p2pkhUtxos = feeUtxos.slice(0, needP2pkhInputs);

        // Call multiSendTokens with buildPsbtCallback
        const result = await multiSendTokens(
            testSigner,
            testProvider,
            tokens,
            maxInputCount,
            maxOutputCount,
            guardTokenTypeCapacity,
            1, // feeRate
            {
                addFeeInput: needFeeInput,
                addFeeChangeOutput: needFeeChangeOutput,
                guardDustLimit,
                buildPsbtCallback: (psbt) => {
                    psbt.setMaximumFeeRate(0xffffffff)
                    // Add p2pkh inputs to reach txi count
                    for (const utxo of p2pkhUtxos) {
                        psbt.spendUTXO(utxo);
                    }
                    // Add fee outputs to reach txo count
                    for (let i = 0; i < needFeeOutputs; i++) {
                        psbt.addOutput({
                            script: Script.fromAddress(mainAddress).toBuffer(),
                            value: 1000n,
                            data: new Uint8Array()
                        });
                    }
                }
            }
        );

        return result;
    }

    describe('cat20Guard_6_6_2', () => {

        // Generate and run all valid test cases

        // Enumerate all values for each parameter
        // txi: [min, random, max] = [2, random(3, 6), 6]
        const txiValues = [2, getRandom(3, 6), 6];
        // tokenIn: [min, random, max] = [1, random(2, 5), 5]
        // Note: will be filtered by constraints tokenIn < txi and tokenIn >= tokenType
        const tokenInValues = [1, getRandom(2, 5), 5];
        // txo: [min, random, max] = [1, random(2, 6), 6]
        const txoValues = [1, getRandom(2, 6), 6];
        // tokenOut: [min, random, max] = [0, random(1, 6), 6]
        // Note: will be filtered by constraint tokenOut <= txo
        const tokenOutValues = [0, getRandom(1, 6), 6];
        // tokenType: only 2 is valid (tokenType > 1 and tokenType <= 2)
        const tokenTypeValues = [1, 2];
        const validCombinations = generateValidCombinations(
            txiValues,
            tokenInValues,
            txoValues,
            tokenOutValues,
            tokenTypeValues
        );
        const totalValid = validCombinations.length;
        validCombinations.forEach(({ txi, tokenIn, txo, tokenOut, tokenType }, index) => {
            it(`(${index + 1}/${totalValid}) should transfer successfully for txi=${txi}, tokenIn=${tokenIn}, txo=${txo}, tokenOut=${tokenOut}, tokenType=${tokenType}`, async () => {
                await transfer(txi, tokenIn, txo, tokenOut, tokenType, 2, 6, 6);
            });
        });


    })

    describe('cat20Guard_6_6_4', () => {
        // maxInputCount=6, maxOutputCount=6, tokenTypeCount=4
        // 6_6_4 can handle 2-6 inputs (not just 5-6)
        // For tokenType=4, need at least 4 token inputs
        const txiValues = [2, getRandom(3, 6), 6];
        const tokenInValues = [1, getRandom(2, 5), 5];
        const txoValues = [1, getRandom(2, 6), 6];
        const tokenOutValues = [0, getRandom(1, 6), 6];
        const tokenTypeValues = [1, getRandom(2, 4), 4];

        const validCombinations = generateValidCombinations(
            txiValues,
            tokenInValues,
            txoValues,
            tokenOutValues,
            tokenTypeValues
        );
        const totalValid = validCombinations.length;
        validCombinations.forEach(({ txi, tokenIn, txo, tokenOut, tokenType }, index) => {
            it(`(${index + 1}/${totalValid}) should transfer successfully for txi=${txi}, tokenIn=${tokenIn}, txo=${txo}, tokenOut=${tokenOut}, tokenType=${tokenType}`, async () => {
                await transfer(txi, tokenIn, txo, tokenOut, tokenType, 4, 6, 6);
            });
        });

    })

    describe('cat20Guard_12_12_2', () => {
        // maxInputCount=12, maxOutputCount=12, tokenTypeCount=2
        // To ensure we use 12_12 guard (not 6_6), we need:
        // txInputCount = tokenIn + guard(1) + fee(0-1) > 6
        // So tokenIn should be >= 6 to guarantee 12_12 guard selection
        // Note: TX_INPUT_COUNT_MAX check uses >=, so max is 11
        const txiValues = [2, getRandom(3, 11), 11];
        const tokenInValues = [1, getRandom(2, 10), 10];
        const txoValues = [1, getRandom(2, 12), 12];
        const tokenOutValues = [0, getRandom(1, 12), 12];
        const tokenTypeValues = [1, 2];

        const validCombinations = generateValidCombinations(
            txiValues,
            tokenInValues,
            txoValues,
            tokenOutValues,
            tokenTypeValues
        );
        const totalValid = validCombinations.length;
        validCombinations.forEach(({ txi, tokenIn, txo, tokenOut, tokenType }, index) => {
            it(`(${index + 1}/${totalValid}) should transfer successfully for txi=${txi}, tokenIn=${tokenIn}, txo=${txo}, tokenOut=${tokenOut}, tokenType=${tokenType}`, async () => {
                await transfer(txi, tokenIn, txo, tokenOut, tokenType, 2, 12, 12);
            });
        });

    })

    describe('cat20Guard_12_12_4', () => {
        // maxInputCount=12, maxOutputCount=12, tokenTypeCount=4
        // To ensure we use 12_12 guard (not 6_6), we need:
        // txInputCount = tokenIn + guard(1) + fee(0-1) > 6
        // So tokenIn should be >= 6 to guarantee 12_12 guard selection
        // For tokenType=4, need at least 4 token inputs minimum
        // Note: TX_INPUT_COUNT_MAX check uses >=, so max is 11
        const txiValues = [2, getRandom(3, 11), 11];
        const tokenInValues = [1, getRandom(2, 10), 10];
        const txoValues = [1, getRandom(2, 12), 12];
        const tokenOutValues = [0, getRandom(1, 12), 12];
        const tokenTypeValues = [1, getRandom(2, 4), 4];

        const validCombinations = generateValidCombinations(
            txiValues,
            tokenInValues,
            txoValues,
            tokenOutValues,
            tokenTypeValues
        );
        const totalValid = validCombinations.length;
        validCombinations.forEach(({ txi, tokenIn, txo, tokenOut, tokenType }, index) => {
            it(`(${index + 1}/${totalValid}) should transfer successfully for txi=${txi}, tokenIn=${tokenIn}, txo=${txo}, tokenOut=${tokenOut}, tokenType=${tokenType}`, async () => {
                await transfer(txi, tokenIn, txo, tokenOut, tokenType, 4, 12, 12);
            });
        });

    })
});
