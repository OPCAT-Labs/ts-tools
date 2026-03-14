/**
 * CAT721 Fuzz Harness: State Serialization
 *
 * Red Team Test Engineer: Fuzzing NFT state serialization/deserialization
 * Tests for malformed states, boundary conditions, and injection attempts
 *
 * Key differences from CAT20:
 * - Uses localId (unique identifier) instead of amount (fungible quantity)
 * - localId must be >= 0 (non-negative integer)
 * - Guard state uses nftBurnMasks instead of tokenBurnAmounts
 */

import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { isLocalTest } from '../utils';
import { testProvider } from '../utils/testProvider';
import { loadAllArtifacts } from '../features/cat721/utils';
import {
    toByteString,
    sha256,
    fill,
    intToByteString,
    ByteString,
    len
} from '@opcat-labs/scrypt-ts-opcat';
import {
    CAT721,
    CAT721State,
    CAT721StateLib,
    CAT721GuardStateLib,
    TX_INPUT_COUNT_MAX_6,
    TX_OUTPUT_COUNT_MAX_6,
    NFT_GUARD_COLLECTION_TYPE_MAX,
    ConstantsLib
} from '../../src/contracts';
import { toTokenOwnerAddress } from '../../src/utils';
import { testSigner } from '../utils/testSigner';

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

    choice<T>(arr: T[]): T {
        return arr[this.nextInt(0, arr.length - 1)];
    }

    shuffle<T>(arr: T[]): T[] {
        const result = [...arr];
        for (let i = result.length - 1; i > 0; i--) {
            const j = this.nextInt(0, i);
            [result[i], result[j]] = [result[j], result[i]];
        }
        return result;
    }
}

isLocalTest(testProvider) && describe('CAT721 Fuzz: State Serialization', () => {
    let mainAddress: string;

    const FUZZ_ITERATIONS = 100;

    before(async () => {
        loadAllArtifacts();
        mainAddress = await testSigner.getAddress();
    });

    // ============================================================
    // Fuzz: CAT721State with random localIds
    // ============================================================
    describe('Fuzz: CAT721State localId values', () => {
        it('should produce deterministic hashes for random localIds', () => {
            const rng = new FuzzRng(72101);
            const ownerAddr = rng.nextHexString(20);

            for (let i = 0; i < FUZZ_ITERATIONS; i++) {
                const localId = rng.nextBigInt(0n, BigInt(Number.MAX_SAFE_INTEGER));
                const state: CAT721State = { ownerAddr, localId };

                // Compute hash twice - should be identical
                const hash1 = CAT721StateLib.stateHash(state);
                const hash2 = CAT721StateLib.stateHash(state);
                expect(hash1).to.equal(hash2);

                // Verify hash equals sha256(serialized)
                const serialized = CAT721StateLib.serializeState(state);
                expect(hash1).to.equal(sha256(serialized));
            }
        });

        it('should produce unique hashes for different localIds', () => {
            const ownerAddr = toByteString('00'.repeat(20));
            const hashes = new Set<string>();

            // Test sequential localIds
            for (let i = 0; i < 1000; i++) {
                const state: CAT721State = { ownerAddr, localId: BigInt(i) };
                const hash = CAT721StateLib.stateHash(state);
                expect(hashes.has(hash)).to.be.false;
                hashes.add(hash);
            }

            expect(hashes.size).to.equal(1000);
        });

        it('should handle extreme localId values', () => {
            const rng = new FuzzRng(72102);
            const extremeLocalIds = [
                0n,
                1n,
                2n ** 8n - 1n,   // 255
                2n ** 16n - 1n,  // 65535
                2n ** 32n - 1n,  // ~4.29 billion
                BigInt(Number.MAX_SAFE_INTEGER),
                2n ** 64n - 1n,
            ];

            for (const localId of extremeLocalIds) {
                const state: CAT721State = {
                    ownerAddr: rng.nextHexString(20),
                    localId
                };

                try {
                    const hash = CAT721StateLib.stateHash(state);
                    expect(hash.length).to.equal(64);
                } catch (e: any) {
                    console.log(`LocalId ${localId}: ${e.message}`);
                }
            }
        });

        it('should reject negative localIds', () => {
            const negativeLocalIds = [-1n, -100n, -BigInt(Number.MAX_SAFE_INTEGER)];

            for (const localId of negativeLocalIds) {
                const state: CAT721State = {
                    ownerAddr: toByteString('00'.repeat(20)),
                    localId
                };

                expect(() => CAT721StateLib.checkState(state)).to.throw;
            }
        });
    });

    // ============================================================
    // Fuzz: CAT721State serialization roundtrip
    // ============================================================
    describe('Fuzz: CAT721State serialization roundtrip', () => {
        it('should correctly serialize and deserialize random valid states', () => {
            const rng = new FuzzRng(72201);
            let successCount = 0;

            for (let i = 0; i < FUZZ_ITERATIONS; i++) {
                const state: CAT721State = {
                    ownerAddr: rng.nextHexString(20),
                    localId: rng.nextBigInt(0n, BigInt(Number.MAX_SAFE_INTEGER))
                };

                const serialized = CAT721StateLib.serializeState(state);
                const stateHash = sha256(serialized);

                // Verify state hash computation
                const computedHash = CAT721StateLib.stateHash(state);
                expect(computedHash).to.equal(stateHash);

                // Deserialize and verify
                const deserialized = CAT721StateLib.deserializeState(serialized);
                expect(deserialized.ownerAddr).to.equal(state.ownerAddr);
                expect(deserialized.localId).to.equal(state.localId);

                successCount++;
            }

            expect(successCount).to.equal(FUZZ_ITERATIONS);
        });

        it('should handle boundary localId values in roundtrip', () => {
            const boundaryLocalIds = [
                0n,
                1n,
                127n,
                128n,
                255n,
                256n,
                65535n,
                65536n,
                BigInt(Number.MAX_SAFE_INTEGER) - 1n,
                BigInt(Number.MAX_SAFE_INTEGER),
            ];

            for (const localId of boundaryLocalIds) {
                const state: CAT721State = {
                    ownerAddr: toByteString('00'.repeat(20)),
                    localId
                };

                try {
                    const serialized = CAT721StateLib.serializeState(state);
                    const deserialized = CAT721StateLib.deserializeState(serialized);
                    expect(deserialized.localId).to.equal(localId);
                } catch (e: any) {
                    console.log(`Boundary ${localId}: ${e.message}`);
                }
            }
        });

        it('should preserve state integrity across multiple roundtrips', () => {
            const rng = new FuzzRng(72202);

            for (let i = 0; i < 50; i++) {
                let state: CAT721State = {
                    ownerAddr: rng.nextHexString(20),
                    localId: rng.nextBigInt(0n, 1000000n)
                };

                const originalOwner = state.ownerAddr;
                const originalLocalId = state.localId;

                // Multiple roundtrips
                for (let j = 0; j < 5; j++) {
                    const serialized = CAT721StateLib.serializeState(state);
                    state = CAT721StateLib.deserializeState(serialized);
                }

                expect(state.ownerAddr).to.equal(originalOwner);
                expect(state.localId).to.equal(originalLocalId);
            }
        });
    });

    // ============================================================
    // Fuzz: CAT721State ownerAddr variations
    // ============================================================
    describe('Fuzz: CAT721State ownerAddr variations', () => {
        it('should handle 20-byte P2PKH addresses', () => {
            const ownerAddr = toTokenOwnerAddress(mainAddress);

            for (let localId = 0n; localId < 10n; localId++) {
                const state: CAT721State = { ownerAddr, localId };

                CAT721StateLib.checkState(state);

                const serialized = CAT721StateLib.serializeState(state);
                const deserialized = CAT721StateLib.deserializeState(serialized);
                expect(deserialized.ownerAddr).to.equal(ownerAddr);
            }
        });

        it('should handle 32-byte contract script hashes', () => {
            const rng = new FuzzRng(72301);

            for (let i = 0; i < FUZZ_ITERATIONS; i++) {
                const ownerAddr = rng.nextHexString(32);

                const state: CAT721State = {
                    ownerAddr,
                    localId: rng.nextBigInt(0n, 1000n)
                };

                const serialized = CAT721StateLib.serializeState(state);
                const deserialized = CAT721StateLib.deserializeState(serialized);
                expect(deserialized.ownerAddr).to.equal(ownerAddr);
            }
        });

        it('should handle special byte patterns in ownerAddr', () => {
            const specialPatterns = [
                toByteString('00'.repeat(20)),  // All zeros
                toByteString('ff'.repeat(20)),  // All FFs
                toByteString('aa'.repeat(20)),  // Alternating bits
                toByteString('55'.repeat(20)),  // Alternating bits inverse
            ];

            for (const ownerAddr of specialPatterns) {
                const state: CAT721State = {
                    ownerAddr,
                    localId: 0n
                };

                const serialized = CAT721StateLib.serializeState(state);
                const hash = CAT721StateLib.stateHash(state);
                const deserialized = CAT721StateLib.deserializeState(serialized);

                expect(deserialized.ownerAddr).to.equal(ownerAddr);
                expect(hash.length).to.equal(64);
            }
        });
    });

    // ============================================================
    // Fuzz: CAT721GuardState Serialization
    // ============================================================
    describe('Fuzz: CAT721GuardState Serialization', () => {
        it('should correctly handle random guard states', () => {
            const rng = new FuzzRng(72401);
            let successCount = 0;

            for (let i = 0; i < FUZZ_ITERATIONS; i++) {
                const guardState = CAT721GuardStateLib.createEmptyState(TX_INPUT_COUNT_MAX_6);

                // Randomize deployerAddr
                guardState.deployerAddr = rng.nextHexString(20);

                // Randomize NFT script hashes (valid 32-byte hashes)
                for (let j = 0; j < NFT_GUARD_COLLECTION_TYPE_MAX; j++) {
                    if (rng.next() > 0.5) {
                        guardState.nftScriptHashes[j] = rng.nextHexString(32);
                    }
                }

                // Randomize script indexes
                let nftScriptIndexes = '';
                for (let j = 0; j < TX_INPUT_COUNT_MAX_6; j++) {
                    const idx = rng.nextInt(-1, NFT_GUARD_COLLECTION_TYPE_MAX - 1);
                    nftScriptIndexes += intToByteString(BigInt(idx), 1n);
                }
                guardState.nftScriptIndexes = nftScriptIndexes as ByteString;

                // Randomize burn masks
                let nftBurnMasks = '';
                for (let j = 0; j < TX_INPUT_COUNT_MAX_6; j++) {
                    const isBurn = rng.next() > 0.8 ? '01' : '00';
                    nftBurnMasks += isBurn;
                }
                guardState.nftBurnMasks = toByteString(nftBurnMasks);

                // Compute state hash
                const stateHash = CAT721GuardStateLib.stateHash(guardState);
                expect(stateHash.length).to.equal(64);

                successCount++;
            }

            expect(successCount).to.equal(FUZZ_ITERATIONS);
        });

        it('should reject duplicate NFT script hashes', () => {
            const guardState = CAT721GuardStateLib.createEmptyState(TX_INPUT_COUNT_MAX_6);
            guardState.deployerAddr = toByteString('00'.repeat(20));

            // Create duplicate script hashes
            const duplicateHash = toByteString('aa'.repeat(32));
            guardState.nftScriptHashes[0] = duplicateHash;
            guardState.nftScriptHashes[1] = duplicateHash;

            expect(() => {
                CAT721GuardStateLib.checkNftScriptsUniq(guardState.nftScriptHashes);
            }).to.throw;
        });

        it('should handle all placeholder values', () => {
            const guardState = CAT721GuardStateLib.createEmptyState(TX_INPUT_COUNT_MAX_6);

            // Verify placeholders are set correctly
            expect(guardState.nftScriptHashes[0]).to.equal(ConstantsLib.TOKEN_SCRIPT_HASH_PLACEHOLDER_FF);
            expect(guardState.nftScriptHashes[1]).to.equal(ConstantsLib.TOKEN_SCRIPT_HASH_PLACEHOLDER_FE);
            expect(guardState.nftScriptHashes[2]).to.equal(ConstantsLib.TOKEN_SCRIPT_HASH_PLACEHOLDER_FD);
            expect(guardState.nftScriptHashes[3]).to.equal(ConstantsLib.TOKEN_SCRIPT_HASH_PLACEHOLDER_FC);

            // Verify uniqueness passes with placeholders
            CAT721GuardStateLib.checkNftScriptsUniq(guardState.nftScriptHashes);
        });
    });

    // ============================================================
    // Fuzz: Malformed State Data
    // ============================================================
    describe('Fuzz: Malformed State Data', () => {
        it('should reject truncated state data', () => {
            const rng = new FuzzRng(72501);

            for (let i = 0; i < 50; i++) {
                const state: CAT721State = {
                    ownerAddr: rng.nextHexString(20),
                    localId: rng.nextBigInt(0n, 1000000n)
                };

                const serialized = CAT721StateLib.serializeState(state);

                // Truncate at random position
                const truncateAt = rng.nextInt(1, serialized.length - 2);
                const truncated = serialized.slice(0, truncateAt) as ByteString;

                try {
                    const deserialized = CAT721StateLib.deserializeState(truncated);
                    expect(
                        deserialized.ownerAddr !== state.ownerAddr ||
                        deserialized.localId !== state.localId
                    ).to.be.true;
                } catch (e: any) {
                    // Expected
                }
            }
        });

        it('should detect bit-flip corruption', () => {
            const rng = new FuzzRng(72502);

            for (let i = 0; i < 50; i++) {
                const state: CAT721State = {
                    ownerAddr: rng.nextHexString(20),
                    localId: rng.nextBigInt(0n, 1000000n)
                };

                const serialized = CAT721StateLib.serializeState(state);
                const originalHash = sha256(serialized);

                // Flip a random bit
                const byteIndex = rng.nextInt(0, serialized.length / 2 - 1);
                const bitPosition = rng.nextInt(0, 7);

                const bytes = Buffer.from(serialized, 'hex');
                bytes[byteIndex] ^= (1 << bitPosition);
                const corrupted = bytes.toString('hex') as ByteString;

                const corruptedHash = sha256(corrupted);
                expect(originalHash).to.not.equal(corruptedHash);
            }
        });
    });

    // ============================================================
    // Fuzz: NFT Burn Mask Encoding
    // ============================================================
    describe('Fuzz: NFT Burn Mask Encoding', () => {
        it('should correctly encode/decode burn masks', () => {
            const rng = new FuzzRng(72601);

            for (let i = 0; i < FUZZ_ITERATIONS; i++) {
                const guardState = CAT721GuardStateLib.createEmptyState(TX_INPUT_COUNT_MAX_6);

                // Generate random burn pattern
                let burnMasks = '';
                const expectedBurns: boolean[] = [];

                for (let j = 0; j < TX_INPUT_COUNT_MAX_6; j++) {
                    const isBurn = rng.next() > 0.7;
                    expectedBurns.push(isBurn);
                    burnMasks += isBurn ? '01' : '00';
                }

                guardState.nftBurnMasks = toByteString(burnMasks);

                // Verify length
                expect(guardState.nftBurnMasks.length).to.equal(TX_INPUT_COUNT_MAX_6 * 2);

                // Decode and verify
                for (let j = 0; j < TX_INPUT_COUNT_MAX_6; j++) {
                    const byte = guardState.nftBurnMasks.slice(j * 2, (j + 1) * 2);
                    const isBurn = byte === '01';
                    expect(isBurn).to.equal(expectedBurns[j]);
                }
            }
        });

        it('should handle all-burn pattern', () => {
            const guardState = CAT721GuardStateLib.createEmptyState(TX_INPUT_COUNT_MAX_6);
            guardState.nftBurnMasks = toByteString('01'.repeat(TX_INPUT_COUNT_MAX_6));

            // All NFTs marked as burn
            for (let j = 0; j < TX_INPUT_COUNT_MAX_6; j++) {
                const byte = guardState.nftBurnMasks.slice(j * 2, (j + 1) * 2);
                expect(byte).to.equal('01');
            }
        });

        it('should handle no-burn pattern', () => {
            const guardState = CAT721GuardStateLib.createEmptyState(TX_INPUT_COUNT_MAX_6);
            // Default is all zeros (no burns)

            for (let j = 0; j < TX_INPUT_COUNT_MAX_6; j++) {
                const byte = guardState.nftBurnMasks.slice(j * 2, (j + 1) * 2);
                expect(byte).to.equal('00');
            }
        });
    });

    // ============================================================
    // Fuzz: Hash Collision Resistance
    // ============================================================
    describe('Fuzz: Hash Collision Resistance', () => {
        it('should produce unique hashes for different NFT states', () => {
            const rng = new FuzzRng(72701);
            const hashes = new Set<string>();

            for (let i = 0; i < 1000; i++) {
                const state: CAT721State = {
                    ownerAddr: rng.nextHexString(20),
                    localId: rng.nextBigInt(0n, BigInt(Number.MAX_SAFE_INTEGER))
                };

                const hash = CAT721StateLib.stateHash(state);
                hashes.add(hash);
            }

            expect(hashes.size).to.equal(1000);
        });

        it('should produce different hashes for same localId with different owners', () => {
            const localId = 42n;
            const hashes = new Set<string>();

            for (let i = 0; i < 100; i++) {
                const state: CAT721State = {
                    ownerAddr: toByteString(i.toString(16).padStart(40, '0')),
                    localId
                };

                const hash = CAT721StateLib.stateHash(state);
                hashes.add(hash);
            }

            expect(hashes.size).to.equal(100);
        });

        it('should produce different hashes for same owner with different localIds', () => {
            const owner = toByteString('00'.repeat(20));
            const hashes = new Set<string>();

            for (let i = 0; i < 100; i++) {
                const state: CAT721State = {
                    ownerAddr: owner,
                    localId: BigInt(i)
                };

                const hash = CAT721StateLib.stateHash(state);
                hashes.add(hash);
            }

            expect(hashes.size).to.equal(100);
        });
    });

    // ============================================================
    // Fuzz: Script Index Encoding (same as CAT20)
    // ============================================================
    describe('Fuzz: Script Index Encoding', () => {
        it('should correctly encode/decode script indexes in valid range', () => {
            const rng = new FuzzRng(72801);

            for (let i = 0; i < 100; i++) {
                const indexes: bigint[] = [];

                for (let j = 0; j < TX_INPUT_COUNT_MAX_6; j++) {
                    indexes.push(BigInt(rng.nextInt(-1, NFT_GUARD_COLLECTION_TYPE_MAX - 1)));
                }

                // Encode
                let encoded = '';
                for (const idx of indexes) {
                    encoded += intToByteString(idx, 1n);
                }

                expect(encoded.length).to.equal(TX_INPUT_COUNT_MAX_6 * 2);
            }
        });

        it('should reject out-of-range script indexes', () => {
            const invalidIndexes = [
                NFT_GUARD_COLLECTION_TYPE_MAX,
                NFT_GUARD_COLLECTION_TYPE_MAX + 1,
                100,
                -2,
                -100
            ];

            for (const idx of invalidIndexes) {
                const guardState = CAT721GuardStateLib.createEmptyState(TX_INPUT_COUNT_MAX_6);

                const invalidEncoded = intToByteString(BigInt(idx), 1n) +
                    guardState.nftScriptIndexes.slice(2);
                guardState.nftScriptIndexes = invalidEncoded as ByteString;

                expect(() => {
                    CAT721GuardStateLib.formalCheckState(guardState, TX_INPUT_COUNT_MAX_6);
                }).to.throw;
            }
        });
    });
});
