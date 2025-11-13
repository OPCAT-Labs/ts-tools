import { describe } from 'mocha';
import { expect } from 'chai';
import { testSigner } from './utils/testSigner';
import { testProvider } from './utils/testProvider';
import { toTokenOwnerAddress } from '../src/utils';
import { ByteString, UTXO } from '@opcat-labs/scrypt-ts-opcat';
import { createCat721, TestCat721 } from './utils/testCAT721Generator';
import { multiSendNfts, CAT721Receiver, MultiNftTransferInfo } from './utils/testCAT721/features/multiSend';
import { verifyTx } from './utils';
import { CAT721GuardPeripheral } from '../src/utils/contractPeripheral';
import { loadAllArtifacts } from './features/cat721/utils';
import { isLocalTest } from './utils';

function getRandom(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateValidCombinations(
    txiValues: number[],
    nftInValues: number[],
    txoValues: number[],
    nftOutValues: number[],
    collectionTypeValues: number[]
): Array<[number, number, number, number, number]> {
    const combinations: Array<[number, number, number, number, number]> = [];

    for (const txi of txiValues) {
        for (const nftIn of nftInValues) {
            for (const txo of txoValues) {
                for (const nftOut of nftOutValues) {
                    for (const collectionType of collectionTypeValues) {
                        if (nftIn <= txi && nftOut <= txo && nftOut == nftIn && collectionType >= 1) {
                            combinations.push([txi, nftIn, txo, nftOut, collectionType]);
                        }
                    }
                }
            }
        }
    }

    return combinations;
}

isLocalTest(testProvider) && describe('cat721Guards', () => {
    let signerAddr: ByteString;
    let cat721Collection1: TestCat721;
    let cat721Collection2: TestCat721;
    let cat721Collection3: TestCat721;
    let cat721Collection4: TestCat721;

    before(async () => {
        loadAllArtifacts();
        signerAddr = await testSigner.getAddress();
        const ownerAddr = toTokenOwnerAddress(signerAddr);

        cat721Collection1 = await createCat721('COLLECTION1', 12, signerAddr);
        cat721Collection2 = await createCat721('COLLECTION2', 12, signerAddr);
        cat721Collection3 = await createCat721('COLLECTION3', 12, signerAddr);
        cat721Collection4 = await createCat721('COLLECTION4', 12, signerAddr);
    });

    async function transfer(
        txi: number,
        nftIn: number,
        txo: number,
        nftOut: number,
        collectionType: number,
        guardCollectionTypeCapacity: number,
        maxInputCount: number,
        maxOutputCount: number
    ) {
        // Distribute nftIn UTXOs across collectionType collections
        const nftsPerCollection = Math.floor(nftIn / collectionType);
        const extraNfts = nftIn % collectionType;

        const collection1NftUtxos = collectionType >= 1
            ? cat721Collection1.utxos.slice(0, nftsPerCollection + (0 < extraNfts ? 1 : 0))
            : [];
        const collection2NftUtxos = collectionType >= 2
            ? cat721Collection2.utxos.slice(0, nftsPerCollection + (1 < extraNfts ? 1 : 0))
            : [];
        const collection3NftUtxos = collectionType >= 3
            ? cat721Collection3.utxos.slice(0, nftsPerCollection + (2 < extraNfts ? 1 : 0))
            : [];
        const collection4NftUtxos = collectionType >= 4
            ? cat721Collection4.utxos.slice(0, nftsPerCollection + (3 < extraNfts ? 1 : 0))
            : [];

        // Distribute nftOut receivers across collectionType collections
        const outputsPerCollection = Math.floor(nftOut / collectionType);
        const extraOutputs = nftOut % collectionType;

        // Helper function to extract localId from NFT UTXO
        const extractLocalId = (nft: UTXO): bigint => {
            const script = Buffer.from(nft.script, 'hex');
            const localIdBytes = script.subarray(script.length - 4, script.length);
            return BigInt('0x' + Buffer.from(localIdBytes).reverse().toString('hex'));
        };

        // Create receivers for each collection
        const collection1Receivers = collectionType >= 1 && outputsPerCollection + (0 < extraOutputs ? 1 : 0) > 0
            ? collection1NftUtxos.slice(0, outputsPerCollection + (0 < extraOutputs ? 1 : 0)).map(nft => ({
                address: toTokenOwnerAddress(signerAddr),
                localId: extractLocalId(nft)
            }))
            : [];

        const collection2Receivers = collectionType >= 2 && outputsPerCollection + (1 < extraOutputs ? 1 : 0) > 0
            ? collection2NftUtxos.slice(0, outputsPerCollection + (1 < extraOutputs ? 1 : 0)).map(nft => ({
                address: toTokenOwnerAddress(signerAddr),
                localId: extractLocalId(nft)
            }))
            : [];

        const collection3Receivers = collectionType >= 3 && outputsPerCollection + (2 < extraOutputs ? 1 : 0) > 0
            ? collection3NftUtxos.slice(0, outputsPerCollection + (2 < extraOutputs ? 1 : 0)).map(nft => ({
                address: toTokenOwnerAddress(signerAddr),
                localId: extractLocalId(nft)
            }))
            : [];

        const collection4Receivers = collectionType >= 4 && outputsPerCollection + (3 < extraOutputs ? 1 : 0) > 0
            ? collection4NftUtxos.slice(0, outputsPerCollection + (3 < extraOutputs ? 1 : 0)).map(nft => ({
                address: toTokenOwnerAddress(signerAddr),
                localId: extractLocalId(nft)
            }))
            : [];

        // Build MultiNftTransferInfo
        const nftInputs: MultiNftTransferInfo = {
            collection1: {
                inputUtxos: collection1NftUtxos,
                receivers: collection1Receivers,
                minterScriptHash: cat721Collection1.generator.minterScriptHash
            }
        };

        if (collectionType >= 2) {
            nftInputs.collection2 = {
                inputUtxos: collection2NftUtxos,
                receivers: collection2Receivers,
                minterScriptHash: cat721Collection2.generator.minterScriptHash
            };
        }

        if (collectionType >= 3) {
            nftInputs.collection3 = {
                inputUtxos: collection3NftUtxos,
                receivers: collection3Receivers,
                minterScriptHash: cat721Collection3.generator.minterScriptHash
            };
        }

        if (collectionType >= 4) {
            nftInputs.collection4 = {
                inputUtxos: collection4NftUtxos,
                receivers: collection4Receivers,
                minterScriptHash: cat721Collection4.generator.minterScriptHash
            };
        }

        // Calculate actual input/output counts
        const actualNftInputCount = collection1NftUtxos.length + collection2NftUtxos.length +
                                    collection3NftUtxos.length + collection4NftUtxos.length;
        const actualNftOutputCount = collection1Receivers.length + collection2Receivers.length +
                                     collection3Receivers.length + collection4Receivers.length;

        const canAddFeeInput = txi > actualNftInputCount + 1; // +1 for guard
        const canAddChangeOutput = txo > actualNftOutputCount;

        // Only add fee input if we can also add a change output (to avoid wasting satoshis as fees)
        const needFeeInput = canAddFeeInput && canAddChangeOutput;
        const needFeeChangeOutput = canAddChangeOutput;

        // When there's no fee input, the guard UTXO needs to have enough satoshis to pay fees
        // Estimate: ~10000 satoshis per input/output should be enough for most transactions
        const guardDustLimit = needFeeInput
            ? undefined
            : BigInt((actualNftInputCount + actualNftOutputCount + 2) * 10000);

        const result = await multiSendNfts(
            testSigner,
            testProvider,
            nftInputs,
            maxInputCount,
            maxOutputCount,
            guardCollectionTypeCapacity,
            1, // feeRate
            {
                addFeeInput: needFeeInput,
                addFeeChangeOutput: needFeeChangeOutput,
                guardDustLimit,
                buildPsbtCallback: (psbt) => {
                    psbt.setMaximumFeeRate(0xffffffff)
                }
            }
        );

        verifyTx(result.guardPsbt, expect);
        verifyTx(result.sendPsbt, expect);

        expect(result.guardTxId).to.be.a('string');
        expect(result.sendTxId).to.be.a('string');
    }

    describe('cat721Guard_6_6_2', () => {
        const maxInputCount = 6;
        const maxOutputCount = 6;
        const guardCollectionTypeCapacity = 2;

        const txiValues = [2, getRandom(3, 5), 5];
        const nftInValues = [1, getRandom(2, 4), 4];
        const txoValues = [2, getRandom(3, 5), 5];
        const nftOutValues = [1, getRandom(2, 4), 4];
        const collectionTypeValues = [1, 2];

        const combinations = generateValidCombinations(
            txiValues,
            nftInValues,
            txoValues,
            nftOutValues,
            collectionTypeValues
        );

        combinations.forEach(([txi, nftIn, txo, nftOut, collectionType]) => {
            it(`should transfer with txi=${txi}, nftIn=${nftIn}, txo=${txo}, nftOut=${nftOut}, collectionType=${collectionType}`, async () => {
                await transfer(txi, nftIn, txo, nftOut, collectionType, guardCollectionTypeCapacity, maxInputCount, maxOutputCount);
            });
        });
    });

    describe('cat721Guard_6_6_4', () => {
        const maxInputCount = 6;
        const maxOutputCount = 6;
        const guardCollectionTypeCapacity = 4;

        const txiValues = [2, getRandom(3, 5), 5];
        const nftInValues = [1, getRandom(2, 4), 4];
        const txoValues = [2, getRandom(3, 5), 5];
        const nftOutValues = [1, getRandom(2, 4), 4];
        const collectionTypeValues = [1, 2, 3, 4];

        const combinations = generateValidCombinations(
            txiValues,
            nftInValues,
            txoValues,
            nftOutValues,
            collectionTypeValues
        );

        combinations.forEach(([txi, nftIn, txo, nftOut, collectionType]) => {
            it(`should transfer with txi=${txi}, nftIn=${nftIn}, txo=${txo}, nftOut=${nftOut}, collectionType=${collectionType}`, async () => {
                await transfer(txi, nftIn, txo, nftOut, collectionType, guardCollectionTypeCapacity, maxInputCount, maxOutputCount);
            });
        });
    });

    describe('cat721Guard_12_12_2', () => {
        const maxInputCount = 12;
        const maxOutputCount = 12;
        const guardCollectionTypeCapacity = 2;

        const txiValues = [2, getRandom(3, 11), 11];
        const nftInValues = [1, getRandom(2, 10), 10];
        const txoValues = [2, getRandom(3, 11), 11];
        const nftOutValues = [1, getRandom(2, 10), 10];
        const collectionTypeValues = [1, 2];

        const combinations = generateValidCombinations(
            txiValues,
            nftInValues,
            txoValues,
            nftOutValues,
            collectionTypeValues
        );

        combinations.forEach(([txi, nftIn, txo, nftOut, collectionType]) => {
            it(`should transfer with txi=${txi}, nftIn=${nftIn}, txo=${txo}, nftOut=${nftOut}, collectionType=${collectionType}`, async () => {
                await transfer(txi, nftIn, txo, nftOut, collectionType, guardCollectionTypeCapacity, maxInputCount, maxOutputCount);
            });
        });
    });

    describe('cat721Guard_12_12_4', () => {
        const maxInputCount = 12;
        const maxOutputCount = 12;
        const guardCollectionTypeCapacity = 4;

        const txiValues = [2, getRandom(3, 11), 11];
        const nftInValues = [1, getRandom(2, 10), 10];
        const txoValues = [2, getRandom(3, 11), 11];
        const nftOutValues = [1, getRandom(2, 10), 10];
        const collectionTypeValues = [1, 2, 3, 4];

        const combinations = generateValidCombinations(
            txiValues,
            nftInValues,
            txoValues,
            nftOutValues,
            collectionTypeValues
        );

        combinations.forEach(([txi, nftIn, txo, nftOut, collectionType]) => {
            it(`should transfer with txi=${txi}, nftIn=${nftIn}, txo=${txo}, nftOut=${nftOut}, collectionType=${collectionType}`, async () => {
                await transfer(txi, nftIn, txo, nftOut, collectionType, guardCollectionTypeCapacity, maxInputCount, maxOutputCount);
            });
        });
    });
});
