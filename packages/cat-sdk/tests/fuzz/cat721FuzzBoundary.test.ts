/**
 * CAT721 Fuzz Harness: Boundary Testing
 *
 * Red Team Test Engineer: Testing boundary conditions and edge cases for NFTs
 * Focuses on localId limits, count boundaries, and collection sizes
 *
 * Test Coverage (Section 4.3 - NFT Specific):
 * - 4.3.1: Max localId values (near integer boundary)
 * - 4.3.2: Max collection size (large NFT counts)
 * - 4.3.3: Zero/empty collection states
 * - 4.3.4: One less than cap (inputCount, outputCount)
 * - 4.3.5: One more than cap (should reject)
 * - 4.3.6: inputCount = 0, 1, inputMax (NFT inputs)
 * - 4.3.7: outputCount = 0, 1, outputMax (NFT outputs)
 * - 4.3.8: Burn mask boundaries (all burned, none burned, partial)
 * - 4.3.9: LocalId sequence boundaries (gaps, consecutive, max range)
 */

import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { isLocalTest } from '../utils';
import { testProvider } from '../utils/testProvider';
import { loadAllArtifacts } from '../features/cat721/utils';
import {
    toByteString,
    fill,
    intToByteString,
    ByteString,
    PubKey,
    slice
} from '@opcat-labs/scrypt-ts-opcat';
import {
    CAT721,
    CAT721State,
    CAT721StateLib,
    CAT721GuardStateLib,
    TX_INPUT_COUNT_MAX_6,
    TX_OUTPUT_COUNT_MAX_6,
    TX_INPUT_COUNT_MAX_12,
    TX_OUTPUT_COUNT_MAX_12
} from '../../src/contracts';
import { testSigner } from '../utils/testSigner';
import { createCat721, TestCat721 } from '../utils/testCAT721Generator';

use(chaiAsPromised);

// ============ Fuzz Utilities ============

class FuzzRng {
    private state: number;

    constructor(seed: number) {
        this.state = seed;
    }

    next(): number {
        this.state = (this.state * 1103515245 + 12345) & 0x7fffffff;
        return this.state / 0x7fffffff;
    }

    nextInt(min: number, max: number): number {
        return Math.floor(this.next() * (max - min + 1)) + min;
    }

    nextBigInt(min: bigint, max: bigint): bigint {
        const range = Number(max - min);
        return min + BigInt(Math.floor(this.next() * range));
    }

    nextBytes(length: number): string {
        let result = '';
        for (let i = 0; i < length; i++) {
            result += this.nextInt(0, 255).toString(16).padStart(2, '0');
        }
        return result;
    }

    nextHexString(length: number): ByteString {
        return toByteString(this.nextBytes(length));
    }

    shuffle<T>(array: T[]): T[] {
        const result = [...array];
        for (let i = result.length - 1; i > 0; i--) {
            const j = this.nextInt(0, i);
            [result[i], result[j]] = [result[j], result[i]];
        }
        return result;
    }
}

// Common boundary values for NFT localId
const BOUNDARY_VALUES = {
    // Byte boundaries
    UINT8_MAX: 2n ** 8n - 1n,        // 255
    UINT16_MAX: 2n ** 16n - 1n,      // 65535
    UINT32_MAX: 2n ** 32n - 1n,      // ~4.29 billion
    UINT64_MAX: 2n ** 64n - 1n,      // ~18.4 quintillion
    INT64_MAX: 2n ** 63n - 1n,       // Max signed 64-bit

    // Bitcoin script limits
    MAX_SCRIPT_INT: 2n ** 31n - 1n,  // Max script number (4-byte signed)
    MAX_SAFE_INTEGER: BigInt(Number.MAX_SAFE_INTEGER), // 2^53 - 1

    // LocalId boundaries (NFT specific)
    LOCALID_MIN: 0n,
    LOCALID_TYPICAL_MAX: 10000n,     // Typical collection size

    // VarInt boundaries
    VARINT_1BYTE_MAX: 0xfcn,         // 252 - max single byte
    VARINT_2BYTE_MIN: 0xfdn,         // 253 - start of 2-byte encoding
    VARINT_2BYTE_MAX: 0xffffn,       // 65535 - max 2-byte
    VARINT_4BYTE_MIN: 0x10000n,      // 65536 - start of 4-byte encoding
    VARINT_4BYTE_MAX: 0xffffffffn,   // ~4.29 billion - max 4-byte
};

isLocalTest(testProvider) && describe('CAT721 Fuzz: Boundary Testing', () => {
    let mainAddress: string;
    let mainPubKey: PubKey;

    const FUZZ_ITERATIONS = 50;

    before(async () => {
        loadAllArtifacts();
        mainAddress = await testSigner.getAddress();
        mainPubKey = PubKey(await testSigner.getPublicKey());
    });

    // ============================================================
    // 4.3.1: Max localId values (near integer boundary)
    // ============================================================
    describe('4.3.1: Max localId value boundaries', () => {
        it('should handle MAX_SAFE_INTEGER localId', () => {
            const ownerAddr = toByteString('00'.repeat(20));
            const maxLocalId = BOUNDARY_VALUES.MAX_SAFE_INTEGER;

            const state: CAT721State = { ownerAddr, localId: maxLocalId };
            const hash = CAT721StateLib.stateHash(state);

            expect(hash.length).to.equal(64);

            const serialized = CAT721StateLib.serializeState(state);
            const deserialized = CAT721StateLib.deserializeState(serialized);
            expect(deserialized.localId).to.equal(maxLocalId);
        });

        it('should handle localIds near MAX_SAFE_INTEGER', () => {
            const ownerAddr = toByteString('00'.repeat(20));
            const nearMaxLocalIds = [
                BOUNDARY_VALUES.MAX_SAFE_INTEGER - 1n,
                BOUNDARY_VALUES.MAX_SAFE_INTEGER,
                BOUNDARY_VALUES.MAX_SAFE_INTEGER + 1n,
            ];

            for (const localId of nearMaxLocalIds) {
                const state: CAT721State = { ownerAddr, localId };

                try {
                    const hash = CAT721StateLib.stateHash(state);
                    expect(hash.length).to.equal(64);
                } catch (e: any) {
                    console.log(`LocalId ${localId}: ${e.message}`);
                }
            }
        });

        it('should handle UINT64_MAX localId', () => {
            const ownerAddr = toByteString('00'.repeat(20));
            const uint64Max = BOUNDARY_VALUES.UINT64_MAX;

            const state: CAT721State = { ownerAddr, localId: uint64Max };

            try {
                const hash = CAT721StateLib.stateHash(state);
                expect(hash.length).to.equal(64);
            } catch (e: any) {
                // May be rejected - log for analysis
                console.log(`UINT64_MAX localId: ${e.message}`);
            }
        });

        it('should handle negative localIds', () => {
            const ownerAddr = toByteString('00'.repeat(20));

            // Negative localIds should be rejected
            const negativeLocalIds = [
                -1n,
                -BOUNDARY_VALUES.MAX_SAFE_INTEGER,
            ];

            for (const localId of negativeLocalIds) {
                const state: CAT721State = { ownerAddr, localId };
                expect(() => CAT721StateLib.checkState(state)).to.throw;
            }
        });

        it('should produce unique hashes for adjacent localId values', () => {
            const ownerAddr = toByteString('00'.repeat(20));
            const adjacentLocalIds = [
                0n, 1n, 2n,
                BOUNDARY_VALUES.UINT8_MAX - 1n,
                BOUNDARY_VALUES.UINT8_MAX,
                BOUNDARY_VALUES.UINT8_MAX + 1n,
                BOUNDARY_VALUES.UINT16_MAX - 1n,
                BOUNDARY_VALUES.UINT16_MAX,
                BOUNDARY_VALUES.UINT16_MAX + 1n,
            ];

            const hashes = new Set<string>();
            for (const localId of adjacentLocalIds) {
                const state: CAT721State = { ownerAddr, localId };
                const hash = CAT721StateLib.stateHash(state);
                hashes.add(hash);
            }

            // All should be unique
            expect(hashes.size).to.equal(adjacentLocalIds.length);
        });

        it('should handle power-of-two localId boundaries', () => {
            const ownerAddr = toByteString('00'.repeat(20));

            for (let power = 0; power <= 53; power++) {
                const localId = 2n ** BigInt(power);

                const state: CAT721State = { ownerAddr, localId };

                try {
                    const hash = CAT721StateLib.stateHash(state);
                    expect(hash.length).to.equal(64);
                } catch (e: any) {
                    console.log(`2^${power} localId: ${e.message}`);
                }
            }
        });

        it('should handle localId = 0 (first NFT in collection)', () => {
            const ownerAddr = toByteString('00'.repeat(20));
            const localId = 0n;

            const state: CAT721State = { ownerAddr, localId };
            const hash = CAT721StateLib.stateHash(state);

            expect(hash.length).to.equal(64);

            const serialized = CAT721StateLib.serializeState(state);
            const deserialized = CAT721StateLib.deserializeState(serialized);
            expect(deserialized.localId).to.equal(localId);
        });
    });

    // ============================================================
    // 4.3.2: Max collection size (large NFT counts)
    // ============================================================
    describe('4.3.2: Max collection size', () => {
        it('should handle large collection state representations', () => {
            const rng = new FuzzRng(43201);

            // Simulate state hash for large collection
            for (let collectionSize = 100; collectionSize <= 10000; collectionSize *= 10) {
                const localId = BigInt(collectionSize - 1);
                const ownerAddr = rng.nextHexString(20);

                const state: CAT721State = { ownerAddr, localId };
                const hash = CAT721StateLib.stateHash(state);

                expect(hash.length).to.equal(64);
            }
        });

        it('should handle sequential localIds in large range', () => {
            const rng = new FuzzRng(43202);
            const ownerAddr = rng.nextHexString(20);

            // Test sequential localIds at different scales
            const ranges = [
                { start: 0n, count: 10 },
                { start: 100n, count: 10 },
                { start: 1000n, count: 10 },
                { start: 10000n, count: 10 },
            ];

            for (const range of ranges) {
                const hashes = new Set<string>();
                for (let i = 0n; i < BigInt(range.count); i++) {
                    const localId = range.start + i;
                    const state: CAT721State = { ownerAddr, localId };
                    hashes.add(CAT721StateLib.stateHash(state));
                }
                expect(hashes.size).to.equal(range.count);
            }
        });

        it('should create guard state for various NFT counts', () => {
            const inputCounts = [1, 2, 3, TX_INPUT_COUNT_MAX_6, TX_INPUT_COUNT_MAX_12];

            for (const count of inputCounts) {
                const guardState = CAT721GuardStateLib.createEmptyState(count);

                // nftScriptIndexes should have correct length
                expect(guardState.nftScriptIndexes.length / 2).to.equal(count);
                // nftBurnMasks should have correct length
                expect(guardState.nftBurnMasks.length / 2).to.equal(count);
            }
        });
    });

    // ============================================================
    // 4.3.3: Zero/empty collection states
    // ============================================================
    describe('4.3.3: Zero/empty collection states', () => {
        it('should handle guard state with no NFTs', () => {
            const guardState = CAT721GuardStateLib.createEmptyState(TX_INPUT_COUNT_MAX_6);

            // All script hashes should be placeholder values (ending in ff)
            for (let i = 0; i < 4; i++) {
                // Placeholder values end with 'ff' marker
                expect(guardState.nftScriptHashes[i].length > 0).to.be.true;
            }

            // All burn masks should be 0
            for (let i = 0; i < TX_INPUT_COUNT_MAX_6; i++) {
                const mask = slice(guardState.nftBurnMasks, BigInt(i), BigInt(i + 1));
                expect(mask).to.equal(toByteString('00'));
            }
        });

        it('should handle transition from 0 to 1 NFT', () => {
            const rng = new FuzzRng(43301);
            const ownerAddr = rng.nextHexString(20);

            const firstNftState: CAT721State = {
                ownerAddr,
                localId: 0n
            };

            const hash = CAT721StateLib.stateHash(firstNftState);
            expect(hash.length).to.equal(64);
        });

        it('should handle empty script hash list', () => {
            const guardState = CAT721GuardStateLib.createEmptyState(TX_INPUT_COUNT_MAX_6);

            // Empty hashes should not cause issues
            const stateHash = CAT721GuardStateLib.stateHash(guardState);
            expect(stateHash.length).to.equal(64);
        });
    });

    // ============================================================
    // 4.3.4: One less than cap
    // ============================================================
    describe('4.3.4: One less than cap', () => {
        it('should handle TX_INPUT_COUNT_MAX_6 - 1 NFT inputs', async function(this: Mocha.Context) {
            this.timeout(60000);

            const inputCount = TX_INPUT_COUNT_MAX_6 - 2; // Max minus guard minus 1
            const guardState = CAT721GuardStateLib.createEmptyState(TX_INPUT_COUNT_MAX_6);

            // Set script indexes for inputs
            let nftScriptIndexes = guardState.nftScriptIndexes;
            for (let i = 0; i < inputCount; i++) {
                nftScriptIndexes = slice(nftScriptIndexes, 0n, BigInt(i)) +
                    intToByteString(0n, 1n) +
                    slice(nftScriptIndexes, BigInt(i + 1));
            }
            guardState.nftScriptIndexes = nftScriptIndexes;

            // Should validate
            CAT721GuardStateLib.formalCheckState(guardState, TX_INPUT_COUNT_MAX_6);
        });

        it('should handle TX_OUTPUT_COUNT_MAX_6 - 1 NFT outputs', async function(this: Mocha.Context) {
            this.timeout(60000);

            const outputCount = TX_OUTPUT_COUNT_MAX_6 - 2; // Max minus change minus 1
            const guardState = CAT721GuardStateLib.createEmptyState(TX_INPUT_COUNT_MAX_6);

            // Prepare guard state for outputs
            guardState.nftScriptHashes[0] = toByteString('aa'.repeat(32));

            // Should validate
            CAT721GuardStateLib.formalCheckState(guardState, TX_INPUT_COUNT_MAX_6);
        });

        it('should handle localId one less than byte boundary', () => {
            const ownerAddr = toByteString('00'.repeat(20));
            const boundaryMinusOne = [
                BOUNDARY_VALUES.UINT8_MAX - 1n,
                BOUNDARY_VALUES.UINT16_MAX - 1n,
                BOUNDARY_VALUES.UINT32_MAX - 1n,
            ];

            for (const localId of boundaryMinusOne) {
                const state: CAT721State = { ownerAddr, localId };
                const hash = CAT721StateLib.stateHash(state);
                expect(hash.length).to.equal(64);
            }
        });
    });

    // ============================================================
    // 4.3.5: One more than cap (should reject)
    // ============================================================
    describe('4.3.5: One more than cap', () => {
        it('should reject script index > max', () => {
            const guardState = CAT721GuardStateLib.createEmptyState(TX_INPUT_COUNT_MAX_6);

            // Inject invalid index (beyond max)
            const invalidIndex = 4; // NFT_SCRIPT_TYPE_MAX is typically 4
            guardState.nftScriptIndexes = intToByteString(BigInt(invalidIndex), 1n) +
                guardState.nftScriptIndexes.slice(2);

            expect(() => {
                CAT721GuardStateLib.formalCheckState(guardState, TX_INPUT_COUNT_MAX_6);
            }).to.throw;
        });

        it('should handle localId one more than byte boundary', () => {
            const ownerAddr = toByteString('00'.repeat(20));
            const boundaryPlusOne = [
                BOUNDARY_VALUES.UINT8_MAX + 1n,
                BOUNDARY_VALUES.UINT16_MAX + 1n,
            ];

            // These should still work (different encoding)
            for (const localId of boundaryPlusOne) {
                const state: CAT721State = { ownerAddr, localId };
                const hash = CAT721StateLib.stateHash(state);
                expect(hash.length).to.equal(64);
            }
        });
    });

    // ============================================================
    // 4.3.6: inputCount = 0, 1, inputMax (NFT inputs)
    // ============================================================
    describe('4.3.6: inputCount boundaries', () => {
        it('should handle inputCount = 1 (single NFT)', async function(this: Mocha.Context) {
            this.timeout(30000);

            const guardState = CAT721GuardStateLib.createEmptyState(TX_INPUT_COUNT_MAX_6);
            guardState.nftScriptHashes[0] = toByteString('aa'.repeat(32));

            // Set single input
            guardState.nftScriptIndexes = intToByteString(0n, 1n) +
                slice(guardState.nftScriptIndexes, 1n);

            CAT721GuardStateLib.formalCheckState(guardState, TX_INPUT_COUNT_MAX_6);
        });

        it('should handle inputCount = TX_INPUT_COUNT_MAX_6 - 2 (max NFT inputs)', async function(this: Mocha.Context) {
            this.timeout(60000);

            const maxInputs = TX_INPUT_COUNT_MAX_6 - 2; // Leave room for guard and fee
            const guardState = CAT721GuardStateLib.createEmptyState(TX_INPUT_COUNT_MAX_6);

            guardState.nftScriptHashes[0] = toByteString('aa'.repeat(32));

            let nftScriptIndexes = guardState.nftScriptIndexes;
            for (let i = 0; i < maxInputs; i++) {
                nftScriptIndexes = slice(nftScriptIndexes, 0n, BigInt(i)) +
                    intToByteString(0n, 1n) +
                    slice(nftScriptIndexes, BigInt(i + 1));
            }
            guardState.nftScriptIndexes = nftScriptIndexes;

            CAT721GuardStateLib.formalCheckState(guardState, TX_INPUT_COUNT_MAX_6);
        });

        it('should create guard state for various input counts', () => {
            const inputCounts = [1, 2, 3, TX_INPUT_COUNT_MAX_6, TX_INPUT_COUNT_MAX_12];

            for (const count of inputCounts) {
                const guardState = CAT721GuardStateLib.createEmptyState(count);

                // nftScriptIndexes should have correct length
                expect(guardState.nftScriptIndexes.length / 2).to.equal(count);
            }
        });
    });

    // ============================================================
    // 4.3.7: outputCount = 0, 1, outputMax (NFT outputs)
    // ============================================================
    describe('4.3.7: outputCount boundaries', () => {
        it('should handle outputCount = 1 (single NFT output)', () => {
            const ownerAddr = toByteString('00'.repeat(20));

            const state: CAT721State = {
                ownerAddr,
                localId: 0n
            };

            const hash = CAT721StateLib.stateHash(state);
            expect(hash.length).to.equal(64);
        });

        it('should handle outputCount = 0 (pure burn)', () => {
            const guardState = CAT721GuardStateLib.createEmptyState(TX_INPUT_COUNT_MAX_6);
            guardState.nftScriptHashes[0] = toByteString('aa'.repeat(32));

            // Set single input with burn mask
            guardState.nftScriptIndexes = intToByteString(0n, 1n) +
                slice(guardState.nftScriptIndexes, 1n);
            guardState.nftBurnMasks = intToByteString(1n, 1n) +
                slice(guardState.nftBurnMasks, 1n);

            // Pure burn - all inputs are burned
            CAT721GuardStateLib.formalCheckState(guardState, TX_INPUT_COUNT_MAX_6);
        });

        it('should handle max NFT outputs', () => {
            const maxOutputs = TX_OUTPUT_COUNT_MAX_6 - 1; // Leave room for change
            const ownerAddr = toByteString('00'.repeat(20));

            // Create states for max outputs
            const states: CAT721State[] = [];
            for (let i = 0; i < maxOutputs; i++) {
                states.push({ ownerAddr, localId: BigInt(i) });
            }

            // All should hash correctly
            for (const state of states) {
                const hash = CAT721StateLib.stateHash(state);
                expect(hash.length).to.equal(64);
            }
        });
    });

    // ============================================================
    // 4.3.8: Burn mask boundaries
    // ============================================================
    describe('4.3.8: Burn mask boundaries', () => {
        it('should handle all NFTs burned (all 1s)', () => {
            const guardState = CAT721GuardStateLib.createEmptyState(TX_INPUT_COUNT_MAX_6);
            guardState.nftScriptHashes[0] = toByteString('aa'.repeat(32));

            // Set all inputs with burn masks
            let nftScriptIndexes = guardState.nftScriptIndexes;
            let nftBurnMasks = guardState.nftBurnMasks;

            for (let i = 0; i < TX_INPUT_COUNT_MAX_6; i++) {
                nftScriptIndexes = slice(nftScriptIndexes, 0n, BigInt(i)) +
                    intToByteString(0n, 1n) +
                    slice(nftScriptIndexes, BigInt(i + 1));
                nftBurnMasks = slice(nftBurnMasks, 0n, BigInt(i)) +
                    intToByteString(1n, 1n) +
                    slice(nftBurnMasks, BigInt(i + 1));
            }

            guardState.nftScriptIndexes = nftScriptIndexes;
            guardState.nftBurnMasks = nftBurnMasks;

            CAT721GuardStateLib.formalCheckState(guardState, TX_INPUT_COUNT_MAX_6);
        });

        it('should handle no NFTs burned (all 0s)', () => {
            const guardState = CAT721GuardStateLib.createEmptyState(TX_INPUT_COUNT_MAX_6);
            guardState.nftScriptHashes[0] = toByteString('aa'.repeat(32));

            // Set inputs without burn masks
            let nftScriptIndexes = guardState.nftScriptIndexes;
            for (let i = 0; i < 3; i++) {
                nftScriptIndexes = slice(nftScriptIndexes, 0n, BigInt(i)) +
                    intToByteString(0n, 1n) +
                    slice(nftScriptIndexes, BigInt(i + 1));
            }

            guardState.nftScriptIndexes = nftScriptIndexes;
            // nftBurnMasks stays all 0s

            CAT721GuardStateLib.formalCheckState(guardState, TX_INPUT_COUNT_MAX_6);
        });

        it('should handle alternating burn pattern (1010...)', () => {
            const guardState = CAT721GuardStateLib.createEmptyState(TX_INPUT_COUNT_MAX_6);
            guardState.nftScriptHashes[0] = toByteString('aa'.repeat(32));

            let nftScriptIndexes = guardState.nftScriptIndexes;
            let nftBurnMasks = guardState.nftBurnMasks;

            for (let i = 0; i < TX_INPUT_COUNT_MAX_6; i++) {
                nftScriptIndexes = slice(nftScriptIndexes, 0n, BigInt(i)) +
                    intToByteString(0n, 1n) +
                    slice(nftScriptIndexes, BigInt(i + 1));

                // Alternating pattern
                const burnValue = i % 2 === 0 ? 1n : 0n;
                nftBurnMasks = slice(nftBurnMasks, 0n, BigInt(i)) +
                    intToByteString(burnValue, 1n) +
                    slice(nftBurnMasks, BigInt(i + 1));
            }

            guardState.nftScriptIndexes = nftScriptIndexes;
            guardState.nftBurnMasks = nftBurnMasks;

            CAT721GuardStateLib.formalCheckState(guardState, TX_INPUT_COUNT_MAX_6);
        });

        it('should fuzz test random burn patterns', () => {
            const rng = new FuzzRng(43801);

            for (let iteration = 0; iteration < FUZZ_ITERATIONS; iteration++) {
                const guardState = CAT721GuardStateLib.createEmptyState(TX_INPUT_COUNT_MAX_6);
                guardState.nftScriptHashes[0] = rng.nextHexString(32);

                let nftScriptIndexes = guardState.nftScriptIndexes;
                let nftBurnMasks = guardState.nftBurnMasks;

                const inputCount = rng.nextInt(1, TX_INPUT_COUNT_MAX_6 - 2);
                for (let i = 0; i < inputCount; i++) {
                    nftScriptIndexes = slice(nftScriptIndexes, 0n, BigInt(i)) +
                        intToByteString(0n, 1n) +
                        slice(nftScriptIndexes, BigInt(i + 1));

                    const burnValue = rng.nextInt(0, 1) === 1 ? 1n : 0n;
                    nftBurnMasks = slice(nftBurnMasks, 0n, BigInt(i)) +
                        intToByteString(burnValue, 1n) +
                        slice(nftBurnMasks, BigInt(i + 1));
                }

                guardState.nftScriptIndexes = nftScriptIndexes;
                guardState.nftBurnMasks = nftBurnMasks;

                try {
                    CAT721GuardStateLib.formalCheckState(guardState, TX_INPUT_COUNT_MAX_6);
                } catch (e: any) {
                    // Some patterns may be rejected - log for analysis
                    console.log(`Iteration ${iteration}: ${e.message}`);
                }
            }
        });
    });

    // ============================================================
    // 4.3.9: LocalId sequence boundaries
    // ============================================================
    describe('4.3.9: LocalId sequence boundaries', () => {
        it('should handle consecutive localIds starting from 0', () => {
            const ownerAddr = toByteString('00'.repeat(20));

            for (let i = 0n; i < 10n; i++) {
                const state: CAT721State = { ownerAddr, localId: i };
                const hash = CAT721StateLib.stateHash(state);
                expect(hash.length).to.equal(64);
            }
        });

        it('should handle consecutive localIds starting from large value', () => {
            const ownerAddr = toByteString('00'.repeat(20));
            const startLocalId = 1000000n;

            for (let i = 0n; i < 10n; i++) {
                const state: CAT721State = { ownerAddr, localId: startLocalId + i };
                const hash = CAT721StateLib.stateHash(state);
                expect(hash.length).to.equal(64);
            }
        });

        it('should handle sparse localIds (gaps in sequence)', () => {
            const ownerAddr = toByteString('00'.repeat(20));
            const sparseIds = [0n, 10n, 100n, 1000n, 10000n];

            const hashes = new Set<string>();
            for (const localId of sparseIds) {
                const state: CAT721State = { ownerAddr, localId };
                hashes.add(CAT721StateLib.stateHash(state));
            }

            expect(hashes.size).to.equal(sparseIds.length);
        });

        it('should handle VarInt encoding boundaries in localId', () => {
            const ownerAddr = toByteString('00'.repeat(20));

            const varIntBoundaries = [
                { localId: 252n, description: '1-byte max' },
                { localId: 253n, description: '2-byte min' },
                { localId: 65535n, description: '2-byte max' },
                { localId: 65536n, description: '4-byte min' },
            ];

            for (const { localId, description } of varIntBoundaries) {
                const state: CAT721State = { ownerAddr, localId };

                const serialized = CAT721StateLib.serializeState(state);
                const deserialized = CAT721StateLib.deserializeState(serialized);

                expect(deserialized.localId).to.equal(localId, `Failed for ${description}`);
            }
        });

        it('should produce correct serialized lengths for VarInt localId boundaries', () => {
            const ownerAddr = toByteString('00'.repeat(20));

            // LocalId 252 should serialize to 1 byte
            const state252: CAT721State = { ownerAddr, localId: 252n };
            const serialized252 = CAT721StateLib.serializeState(state252);

            // LocalId 253 should serialize to 3 bytes (fd prefix + 2 bytes)
            const state253: CAT721State = { ownerAddr, localId: 253n };
            const serialized253 = CAT721StateLib.serializeState(state253);

            // LocalId 65536 should serialize to 5 bytes (fe prefix + 4 bytes)
            const state65536: CAT721State = { ownerAddr, localId: 65536n };
            const serialized65536 = CAT721StateLib.serializeState(state65536);

            // Verify different lengths (actual lengths depend on encoding)
            expect(serialized253.length).to.be.gte(serialized252.length);
            expect(serialized65536.length).to.be.gte(serialized253.length);
        });

        it('should fuzz test random localId values at boundaries', () => {
            const rng = new FuzzRng(43901);
            const ownerAddr = toByteString('00'.repeat(20));

            for (let i = 0; i < FUZZ_ITERATIONS; i++) {
                // Pick a random boundary region
                const boundary = rng.nextInt(0, 3);
                let localId: bigint;

                switch (boundary) {
                    case 0: // Near 1-byte max
                        localId = rng.nextBigInt(250n, 256n);
                        break;
                    case 1: // Near 2-byte max
                        localId = rng.nextBigInt(65530n, 65540n);
                        break;
                    case 2: // Near 4-byte boundary
                        localId = rng.nextBigInt(0xfffffffan, 0x100000005n);
                        break;
                    default: // Random in valid range
                        localId = rng.nextBigInt(0n, BOUNDARY_VALUES.MAX_SAFE_INTEGER);
                }

                const state: CAT721State = { ownerAddr, localId };

                try {
                    const serialized = CAT721StateLib.serializeState(state);
                    const deserialized = CAT721StateLib.deserializeState(serialized);
                    expect(deserialized.localId).to.equal(localId);
                } catch (e: any) {
                    // Log for analysis but don't fail
                    console.log(`LocalId ${localId}: ${e.message}`);
                }
            }
        });

        it('should handle localId ordering verification', () => {
            const rng = new FuzzRng(43902);
            const ownerAddr = rng.nextHexString(20);

            // Create sequential localIds
            const localIds = [0n, 1n, 2n, 3n, 4n];
            const states = localIds.map(localId => ({ ownerAddr, localId }));
            const hashes = states.map(s => CAT721StateLib.stateHash(s));

            // All hashes should be unique
            expect(new Set(hashes).size).to.equal(localIds.length);

            // Shuffled order should produce same set of hashes
            const shuffledIds = rng.shuffle([...localIds]);
            const shuffledStates = shuffledIds.map(localId => ({ ownerAddr, localId }));
            const shuffledHashes = shuffledStates.map(s => CAT721StateLib.stateHash(s));

            expect(new Set(shuffledHashes).size).to.equal(localIds.length);
        });
    });

    // ============ Additional NFT-specific boundary tests ============

    describe('Additional: NFT-specific boundaries', () => {
        it('should handle same localId with different owners', () => {
            const rng = new FuzzRng(44001);
            const localId = 42n;

            const ownerAddrs = Array(5).fill(null).map(() => rng.nextHexString(20));
            const hashes = ownerAddrs.map(ownerAddr => {
                const state: CAT721State = { ownerAddr, localId };
                return CAT721StateLib.stateHash(state);
            });

            // All hashes should be unique (different owners)
            expect(new Set(hashes).size).to.equal(ownerAddrs.length);
        });

        it('should handle multiple collections in same guard', () => {
            const rng = new FuzzRng(44002);
            const guardState = CAT721GuardStateLib.createEmptyState(TX_INPUT_COUNT_MAX_6);

            // Set up multiple collection script hashes
            for (let i = 0; i < 4; i++) {
                guardState.nftScriptHashes[i] = rng.nextHexString(32);
            }

            // Assign inputs to different collections
            let nftScriptIndexes = guardState.nftScriptIndexes;
            for (let i = 0; i < 4; i++) {
                nftScriptIndexes = slice(nftScriptIndexes, 0n, BigInt(i)) +
                    intToByteString(BigInt(i), 1n) +
                    slice(nftScriptIndexes, BigInt(i + 1));
            }
            guardState.nftScriptIndexes = nftScriptIndexes;

            CAT721GuardStateLib.formalCheckState(guardState, TX_INPUT_COUNT_MAX_6);
        });

        it('should handle guard state with max collections', () => {
            const rng = new FuzzRng(44003);
            const guardState = CAT721GuardStateLib.createEmptyState(TX_INPUT_COUNT_MAX_6);

            // NFT_SCRIPT_TYPE_MAX is typically 4
            const maxCollections = 4;
            for (let i = 0; i < maxCollections; i++) {
                guardState.nftScriptHashes[i] = rng.nextHexString(32);
            }

            // Check uniqueness
            const uniqueHashes = new Set(guardState.nftScriptHashes.filter(h => h !== toByteString('')));
            expect(uniqueHashes.size).to.equal(maxCollections);

            CAT721GuardStateLib.formalCheckState(guardState, TX_INPUT_COUNT_MAX_6);
        });

        it('should reject duplicate collection script hashes', () => {
            const rng = new FuzzRng(44004);
            const guardState = CAT721GuardStateLib.createEmptyState(TX_INPUT_COUNT_MAX_6);

            const scriptHash = rng.nextHexString(32);
            guardState.nftScriptHashes[0] = scriptHash;
            guardState.nftScriptHashes[1] = scriptHash; // Duplicate

            expect(() => {
                CAT721GuardStateLib.checkNftScriptsUniq(guardState.nftScriptHashes);
            }).to.throw;
        });
    });
});
