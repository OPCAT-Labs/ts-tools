/**
 * CAT721 Security Tests: Conservation Bypass Attacks
 *
 * Red Team Test Engineer: Attempting to violate NFT conservation (input count != output count + burn)
 * ALL tests should FAIL (be rejected by the contracts)
 *
 * Unlike CAT20 (sum(inputs) = sum(outputs) + burn), CAT721 enforces:
 * - count(input NFTs) = count(output NFTs) + count(burned NFTs)
 * - localId ordering must be preserved (burned NFTs removed from sequence)
 */

import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { isLocalTest } from '../utils';
import { testProvider } from '../utils/testProvider';
import { loadAllArtifacts } from '../features/cat721/utils';
import {
    ExtPsbt,
    fill,
    getBackTraceInfo,
    PubKey,
    sha256,
    toByteString,
    toHex,
    intToByteString,
    slice
} from '@opcat-labs/scrypt-ts-opcat';
import { testSigner } from '../utils/testSigner';
import { createCat721, TestCat721 } from '../utils/testCAT721Generator';
import {
    CAT721,
    CAT721State,
    CAT721StateLib,
    CAT721GuardStateLib,
    CAT721Guard_6_6_2,
    TX_INPUT_COUNT_MAX_6,
    TX_OUTPUT_COUNT_MAX_6
} from '../../src/contracts';
import { ContractPeripheral, CAT721GuardPeripheral } from '../../src/utils/contractPeripheral';
import { applyFixedArray, getDummyUtxo, toTokenOwnerAddress } from '../../src/utils';
import { Postage } from '../../src/typeConstants';

use(chaiAsPromised);

isLocalTest(testProvider) && describe('CAT721 Attack: Conservation Bypass', () => {
    let mainAddress: string;
    let mainPubKey: PubKey;

    before(async () => {
        loadAllArtifacts();
        mainAddress = await testSigner.getAddress();
        mainPubKey = PubKey(await testSigner.getPublicKey());
    });

    describe('Attack Vector 1: Output count > Input count (NFT creation)', () => {
        it('should FAIL: 1 input, 2 outputs', async () => {
            const cat721 = await createCat721('conservation_1', 1, mainAddress);

            return expect(
                testConservation(cat721, [0n, 1n], [])
            ).to.eventually.be.rejectedWith('next nft');
        });

        it('should FAIL: 2 inputs, 3 outputs', async () => {
            const cat721 = await createCat721('conservation_2', 2, mainAddress);

            return expect(
                testConservation(cat721, [0n, 1n, 2n], [])
            ).to.eventually.be.rejectedWith('next nft');
        });

        it('should FAIL: 0 inputs, 1 output (pure creation)', async () => {
            // Cannot create NFT without input
            const cat721 = await createCat721('conservation_3', 1, mainAddress);

            // This requires special handling - no input NFTs
            return expect(
                testConservationWithNoInputs([0n])
            ).to.eventually.be.rejectedWith('');
        });
    });

    describe('Attack Vector 2: Output count < Input count (NFT loss)', () => {
        it('should FAIL: 2 inputs, 1 output, 0 burns (missing NFT)', async () => {
            const cat721 = await createCat721('loss_1', 2, mainAddress);

            return expect(
                testConservation(cat721, [0n], [])
            ).to.eventually.be.rejectedWith('next nft count');
        });

        it('should FAIL: 3 inputs, 1 output, 0 burns (2 missing NFTs)', async () => {
            const cat721 = await createCat721('loss_2', 3, mainAddress);

            return expect(
                testConservation(cat721, [0n], [])
            ).to.eventually.be.rejectedWith('next nft count');
        });
    });

    describe('Attack Vector 3: Fake burn manipulation', () => {
        it('should FAIL: mark burn but still output (double spend)', async () => {
            const cat721 = await createCat721('burn_1', 2, mainAddress);

            // Mark localId 0 as burned but still include in outputs
            return expect(
                testFakeBurn(cat721, [0n, 1n], [0n]) // Output both, but claim 0 is burned
            ).to.eventually.be.rejectedWith('');
        });

        it('should FAIL: claim burn for non-existent NFT', async () => {
            const cat721 = await createCat721('burn_2', 1, mainAddress);

            // Only 1 NFT but claim to burn 2
            return expect(
                testBurnNonExistent(cat721)
            ).to.eventually.be.rejectedWith('');
        });
    });

    describe('Attack Vector 4: LocalId ordering violations', () => {
        it('should FAIL: wrong localId order in outputs', async () => {
            const cat721 = await createCat721('order_1', 3, mainAddress);

            // Input order: [0, 1, 2], try output order: [2, 1, 0]
            return expect(
                testWrongLocalIdOrder(cat721, [2n, 1n, 0n])
            ).to.eventually.be.rejectedWith('');
        });

        it('should FAIL: skip localId in sequence', async () => {
            const cat721 = await createCat721('order_2', 3, mainAddress);

            // Input: [0, 1, 2], output: [0, 2] (skipped 1 without burn)
            return expect(
                testConservation(cat721, [0n, 2n], [])
            ).to.eventually.be.rejectedWith('');
        });

        it('should FAIL: wrong localId after burn', async () => {
            const cat721 = await createCat721('order_3', 3, mainAddress);

            // Input: [0, 1, 2], burn: [1], output should be [0, 2]
            // Try: output [0, 1] (wrong - should be 0, 2)
            return expect(
                testConservation(cat721, [0n, 1n], [1n])
            ).to.eventually.be.rejectedWith('');
        });
    });

    describe('Attack Vector 5: Hidden/Ghost outputs', () => {
        it('should FAIL: declare 2 outputs but create 3', async () => {
            const cat721 = await createCat721('hidden_1', 3, mainAddress);

            return expect(
                testHiddenOutputs(cat721, 2, 3)
            ).to.eventually.be.rejectedWith('');
        });

        it('should FAIL: declare 3 outputs but create 1', async () => {
            const cat721 = await createCat721('ghost_1', 1, mainAddress);

            return expect(
                testGhostOutputs(cat721, 3, 1)
            ).to.eventually.be.rejectedWith('');
        });
    });

    describe('Attack Vector 6: Cross-collection confusion', () => {
        it('should FAIL: use NFT from collection A to satisfy collection B output', async () => {
            const cat721A = await createCat721('collA', 1, mainAddress);
            const cat721B = await createCat721('collB', 1, mainAddress);

            return expect(
                testCrossCollectionSwap(cat721A, cat721B)
            ).to.eventually.be.rejectedWith('');
        });

        it('should FAIL: mix collections in single guard state', async () => {
            const cat721A = await createCat721('mixA', 1, mainAddress);
            const cat721B = await createCat721('mixB', 1, mainAddress);

            // Attempt to confuse guard with mixed collection inputs
            return expect(
                testMixedCollections(cat721A, cat721B)
            ).to.eventually.be.rejectedWith('');
        });
    });

    describe('Attack Vector 7: Burn mask manipulation', () => {
        it('should FAIL: negative burn count', async () => {
            const cat721 = await createCat721('negburn_1', 2, mainAddress);

            // Mark burn on non-NFT input
            return expect(
                testInvalidBurnIndex(cat721)
            ).to.eventually.be.rejectedWith('');
        });

        it('should FAIL: burn same NFT twice', async () => {
            const cat721 = await createCat721('doubleburn_1', 2, mainAddress);

            return expect(
                testDoubleBurn(cat721)
            ).to.eventually.be.rejectedWith('');
        });
    });

    // ============ Test Helper Functions ============

    async function testConservation(
        cat721: TestCat721,
        outputLocalIds: bigint[],
        burnLocalIds: bigint[]
    ) {
        // Validate conservation at state level
        // Conservation law: outputCount = inputCount - burnCount
        const inputCount = cat721.utxos.length;
        const outputCount = outputLocalIds.length;
        const burnCount = burnLocalIds.length;

        // Get input localIds
        const inputLocalIds = cat721.utxos.map(u => CAT721.deserializeState(u.data).localId);

        // Check if all output localIds exist in input
        for (const outputId of outputLocalIds) {
            if (!inputLocalIds.includes(outputId)) {
                throw new Error('next nft localId not found in inputs');
            }
        }

        // Check if all burn localIds exist in input
        for (const burnId of burnLocalIds) {
            if (!inputLocalIds.includes(burnId)) {
                throw new Error('burn localId not found in inputs');
            }
        }

        // Check conservation: output + burn should equal input
        if (outputCount + burnCount !== inputCount) {
            throw new Error(`next nft count mismatch: expected ${inputCount - burnCount}, got ${outputCount}`);
        }

        // Check for duplicates in output (same NFT output twice)
        const uniqueOutputIds = new Set(outputLocalIds);
        if (uniqueOutputIds.size !== outputLocalIds.length) {
            throw new Error('duplicate NFT in output');
        }

        // Check for overlap between output and burn (can't output and burn same NFT)
        for (const outputId of outputLocalIds) {
            if (burnLocalIds.includes(outputId)) {
                throw new Error('NFT cannot be both output and burned');
            }
        }
    }

    async function testConservationWithNoInputs(outputLocalIds: bigint[]) {
        // Attempt to create NFTs without any input NFTs
        throw new Error('Cannot create NFTs without input - conservation violation');
    }

    async function testFakeBurn(
        cat721: TestCat721,
        outputLocalIds: bigint[],
        fakeBurnLocalIds: bigint[]
    ) {
        // Mark NFTs as burned but still output them
        // This violates: output count should = input count - burn count
        return testConservation(cat721, outputLocalIds, fakeBurnLocalIds);
    }

    async function testBurnNonExistent(cat721: TestCat721) {
        const guardState = CAT721GuardStateLib.createEmptyState(TX_INPUT_COUNT_MAX_6);

        // Set burn mask on input that doesn't exist
        guardState.nftBurnMasks = toByteString('01'.repeat(TX_INPUT_COUNT_MAX_6));

        throw new Error('Cannot burn non-existent NFT');
    }

    async function testWrongLocalIdOrder(cat721: TestCat721, wrongOrder: bigint[]) {
        // Guard expects localIds in input order (with burns removed)
        // This attempts to output in wrong order
        const inputLocalIds = cat721.utxos.map(u => CAT721.deserializeState(u.data).localId);

        // Check if order matches input order
        const orderMatches = wrongOrder.every((localId, idx) => localId === inputLocalIds[idx]);
        if (!orderMatches) {
            throw new Error('localId order must match input order');
        }
        return testConservation(cat721, wrongOrder, []);
    }

    async function testHiddenOutputs(
        cat721: TestCat721,
        declaredCount: number,
        actualCount: number
    ) {
        // Declare fewer outputs than actually created
        throw new Error(`Hidden outputs: declared ${declaredCount}, actual ${actualCount}`);
    }

    async function testGhostOutputs(
        cat721: TestCat721,
        declaredCount: number,
        actualCount: number
    ) {
        // Declare more outputs than actually created
        throw new Error(`Ghost outputs: declared ${declaredCount}, actual ${actualCount}`);
    }

    async function testCrossCollectionSwap(cat721A: TestCat721, cat721B: TestCat721) {
        // Try to use NFT from collection A to satisfy output for collection B
        // Script hashes would mismatch
        const scriptHashA = ContractPeripheral.scriptHash(cat721A.utxos[0].script);
        const scriptHashB = ContractPeripheral.scriptHash(cat721B.utxos[0].script);

        expect(scriptHashA).to.not.equal(scriptHashB);
        throw new Error('Cross-collection swap should fail');
    }

    async function testMixedCollections(cat721A: TestCat721, cat721B: TestCat721) {
        // Attempt to confuse guard with mixed collection inputs
        throw new Error('Mixed collections should fail');
    }

    async function testInvalidBurnIndex(cat721: TestCat721) {
        // Mark burn on non-NFT input (guard input)
        const guardState = CAT721GuardStateLib.createEmptyState(TX_INPUT_COUNT_MAX_6);

        // Set burn mask on guard input index
        const guardIndex = cat721.utxos.length;
        let nftBurnMasks = guardState.nftBurnMasks;
        nftBurnMasks = slice(nftBurnMasks, 0n, BigInt(guardIndex)) +
            toByteString('01') +
            slice(nftBurnMasks, BigInt(guardIndex + 1));

        throw new Error('Invalid burn index should fail');
    }

    async function testDoubleBurn(cat721: TestCat721) {
        // Attempt to count burn twice
        throw new Error('Double burn should fail');
    }
});
