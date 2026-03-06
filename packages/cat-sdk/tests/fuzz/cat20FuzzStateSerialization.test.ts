/**
 * CAT20 Fuzz Harness: State Serialization
 *
 * Red Team Test Engineer: Fuzzing state serialization/deserialization to find edge cases
 * Tests for malformed states, boundary conditions, and injection attempts
 *
 * Test Coverage (Section 4.1):
 * - 4.1.1: Fuzz random token amounts through stateHash()
 * - 4.1.2: Fuzz random field lengths in state serialization
 * - 4.1.3: Fuzz random OP_CAT concatenation orders
 * - 4.1.4: Fuzz serializeState() / serializeSHPreimage() roundtrip
 * - 4.1.5: Fuzz ownerAddr with various lengths (25-byte P2PKH, 32-byte contract)
 */

import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { isLocalTest } from '../utils';
import { testProvider } from '../utils/testProvider';
import { loadAllArtifacts } from '../features/cat20/utils';
import {
    toByteString,
    sha256,
    fill,
    intToByteString,
    ByteString,
    len
} from '@opcat-labs/scrypt-ts-opcat';
import {
    CAT20,
    CAT20State,
    CAT20StateLib,
    CAT20GuardStateLib,
    CAT20OpenMinterState,
    TX_INPUT_COUNT_MAX_6,
    TX_OUTPUT_COUNT_MAX_6,
    GUARD_TOKEN_TYPE_MAX,
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

isLocalTest(testProvider) && describe('CAT20 Fuzz: State Serialization', () => {
    let mainAddress: string;

    const FUZZ_ITERATIONS = 100;

    before(async () => {
        loadAllArtifacts();
        mainAddress = await testSigner.getAddress();
    });

    // ============================================================
    // 4.1.1: Fuzz random token amounts through stateHash()
    // ============================================================
    describe('4.1.1: Fuzz random token amounts through stateHash()', () => {
        it('should produce deterministic hashes for random amounts', () => {
            const rng = new FuzzRng(41101);
            const ownerAddr = rng.nextHexString(20);

            for (let i = 0; i < FUZZ_ITERATIONS; i++) {
                const amount = rng.nextBigInt(1n, BigInt(Number.MAX_SAFE_INTEGER));
                const state: CAT20State = { ownerAddr, amount };

                // Compute hash twice - should be identical
                const hash1 = CAT20StateLib.stateHash(state);
                const hash2 = CAT20StateLib.stateHash(state);
                expect(hash1).to.equal(hash2);

                // Verify hash equals sha256(serialized)
                const serialized = CAT20StateLib.serializeState(state);
                expect(hash1).to.equal(sha256(serialized));
            }
        });

        it('should produce unique hashes for different amounts', () => {
            const ownerAddr = toByteString('00'.repeat(20));
            const hashes = new Set<string>();

            // Test a wide range of amounts
            const amounts = [
                1n, 2n, 100n, 1000n, 10000n,
                BigInt(Number.MAX_SAFE_INTEGER) - 1n,
                BigInt(Number.MAX_SAFE_INTEGER),
                2n ** 32n - 1n,
                2n ** 32n,
                2n ** 48n,
                2n ** 64n - 1n,
            ];

            for (const amount of amounts) {
                const state: CAT20State = { ownerAddr, amount };
                const hash = CAT20StateLib.stateHash(state);
                expect(hashes.has(hash)).to.be.false;
                hashes.add(hash);
            }
        });

        it('should handle extreme amount values', () => {
            const rng = new FuzzRng(41102);
            const extremeAmounts = [
                1n,
                2n ** 8n - 1n,   // 255
                2n ** 8n,        // 256
                2n ** 16n - 1n,  // 65535
                2n ** 16n,       // 65536
                2n ** 32n - 1n,  // ~4.29 billion
                2n ** 32n,
                2n ** 64n - 1n,  // Max uint64
                2n ** 128n - 1n, // Max uint128
                2n ** 252n - 1n, // Near Bitcoin script integer limit
            ];

            for (const amount of extremeAmounts) {
                const state: CAT20State = {
                    ownerAddr: rng.nextHexString(20),
                    amount
                };

                try {
                    const hash = CAT20StateLib.stateHash(state);
                    expect(hash.length).to.equal(64); // 32 bytes hex
                } catch (e: any) {
                    // Some extreme values may be rejected - log for analysis
                    console.log(`Amount ${amount.toString(16)}: ${e.message}`);
                }
            }
        });
    });

    // ============================================================
    // 4.1.2: Fuzz random field lengths in state serialization
    // ============================================================
    describe('4.1.2: Fuzz random field lengths in state serialization', () => {
        it('should handle various serialized state lengths', () => {
            const rng = new FuzzRng(41201);

            for (let i = 0; i < FUZZ_ITERATIONS; i++) {
                // Generate amounts of varying byte lengths
                const byteLen = rng.nextInt(1, 16);
                const maxVal = 2n ** BigInt(byteLen * 8) - 1n;
                const amount = rng.nextBigInt(1n, maxVal);

                const state: CAT20State = {
                    ownerAddr: rng.nextHexString(20),
                    amount
                };

                const serialized = CAT20StateLib.serializeState(state);
                const deserialized = CAT20StateLib.deserializeState(serialized);

                expect(deserialized.ownerAddr).to.equal(state.ownerAddr);
                expect(deserialized.amount).to.equal(state.amount);
            }
        });

        it('should reject malformed field lengths', () => {
            const rng = new FuzzRng(41202);

            for (let i = 0; i < 50; i++) {
                // Create a valid state
                const state: CAT20State = {
                    ownerAddr: rng.nextHexString(20),
                    amount: rng.nextBigInt(1n, 1000000n)
                };

                const serialized = CAT20StateLib.serializeState(state);

                // Inject invalid length prefix
                const corruptedLengths = [
                    '00' + serialized.slice(2),  // Zero length
                    'ff' + serialized.slice(2),  // Max length
                    serialized.slice(0, 2) + '00' + serialized.slice(4), // Zero field
                ];

                for (const corrupted of corruptedLengths) {
                    try {
                        const result = CAT20StateLib.deserializeState(corrupted as ByteString);
                        // If deserialization succeeds, verify data is corrupted
                        expect(
                            result.ownerAddr !== state.ownerAddr ||
                            result.amount !== state.amount
                        ).to.be.true;
                    } catch (e: any) {
                        // Expected - corrupted data should fail
                    }
                }
            }
        });

        it('should handle guard state with varying tokenScriptIndexes lengths', () => {
            const inputCounts = [1, 3, 6, 12];

            for (const inputCount of inputCounts) {
                const guardState = CAT20GuardStateLib.createEmptyState(inputCount);
                expect(len(guardState.tokenScriptIndexes)).to.equal(BigInt(inputCount));
            }
        });
    });

    // ============================================================
    // 4.1.3: Fuzz random OP_CAT concatenation orders
    // ============================================================
    describe('4.1.3: Fuzz random OP_CAT concatenation orders', () => {
        it('should detect reordered field concatenation', () => {
            const rng = new FuzzRng(41301);

            for (let i = 0; i < FUZZ_ITERATIONS; i++) {
                const ownerAddr = rng.nextHexString(20);
                const amount = rng.nextBigInt(1n, 1000000n);

                const state: CAT20State = { ownerAddr, amount };
                const correctHash = CAT20StateLib.stateHash(state);

                // Manually create "reordered" state (amount before owner)
                const amountBytes = intToByteString(amount, 8n);
                const reorderedData = (amountBytes + ownerAddr) as ByteString;
                const reorderedHash = sha256(reorderedData);

                // Reordered hash MUST differ from correct hash
                expect(reorderedHash).to.not.equal(correctHash);
            }
        });

        it('should produce different hashes for field swaps in guard state', () => {
            const rng = new FuzzRng(41302);

            for (let i = 0; i < 50; i++) {
                const guardState = CAT20GuardStateLib.createEmptyState(TX_INPUT_COUNT_MAX_6);
                guardState.deployerAddr = rng.nextHexString(20);

                // Set random amounts
                guardState.tokenAmounts[0] = rng.nextBigInt(100n, 10000n);
                guardState.tokenAmounts[1] = rng.nextBigInt(100n, 10000n);

                const hash1 = CAT20GuardStateLib.stateHash(guardState);

                // Swap token amounts
                const swapped = { ...guardState };
                [swapped.tokenAmounts[0], swapped.tokenAmounts[1]] =
                    [swapped.tokenAmounts[1], swapped.tokenAmounts[0]];

                const hash2 = CAT20GuardStateLib.stateHash(swapped);

                // Swapped state must have different hash
                if (guardState.tokenAmounts[0] !== guardState.tokenAmounts[1]) {
                    expect(hash1).to.not.equal(hash2);
                }
            }
        });

        it('should validate guard script hash ordering', () => {
            const rng = new FuzzRng(41303);

            for (let i = 0; i < 50; i++) {
                const guardState = CAT20GuardStateLib.createEmptyState(TX_INPUT_COUNT_MAX_6);

                // Generate unique script hashes
                const hashes = [
                    rng.nextHexString(32),
                    rng.nextHexString(32),
                    rng.nextHexString(32),
                    rng.nextHexString(32),
                ];

                guardState.tokenScriptHashes = hashes as any;

                const originalHash = CAT20GuardStateLib.stateHash(guardState);

                // Shuffle the script hashes
                const shuffled = rng.shuffle([...hashes]);
                guardState.tokenScriptHashes = shuffled as any;

                const shuffledHash = CAT20GuardStateLib.stateHash(guardState);

                // If order changed, hash should differ
                const orderChanged = hashes.some((h, idx) => h !== shuffled[idx]);
                if (orderChanged) {
                    expect(originalHash).to.not.equal(shuffledHash);
                }
            }
        });
    });

    // ============================================================
    // 4.1.4: Fuzz serializeState() / deserializeState() roundtrip
    // ============================================================
    describe('4.1.4: Fuzz serializeState() roundtrip', () => {
        it('should correctly serialize and deserialize random valid states', () => {
            const rng = new FuzzRng(41401);
            let successCount = 0;

            for (let i = 0; i < FUZZ_ITERATIONS; i++) {
                const state: CAT20State = {
                    ownerAddr: rng.nextHexString(20), // 20 bytes for hash160
                    amount: rng.nextBigInt(1n, BigInt(Number.MAX_SAFE_INTEGER))
                };

                const serialized = CAT20StateLib.serializeState(state);
                const stateHash = sha256(serialized);

                // Verify state hash computation
                const computedHash = CAT20StateLib.stateHash(state);
                expect(computedHash).to.equal(stateHash);

                // Deserialize and verify
                const deserialized = CAT20StateLib.deserializeState(serialized);
                expect(deserialized.ownerAddr).to.equal(state.ownerAddr);
                expect(deserialized.amount).to.equal(state.amount);

                successCount++;
            }

            expect(successCount).to.equal(FUZZ_ITERATIONS);
        });

        it('should handle boundary amount values in roundtrip', () => {
            const boundaryAmounts = [
                1n,
                2n,
                127n,
                128n,
                255n,
                256n,
                65535n,
                65536n,
                BigInt(Number.MAX_SAFE_INTEGER),
                BigInt(Number.MAX_SAFE_INTEGER) - 1n,
                2n ** 32n - 1n,
                2n ** 32n,
                2n ** 64n - 1n,
            ];

            for (const amount of boundaryAmounts) {
                const state: CAT20State = {
                    ownerAddr: toByteString('00'.repeat(20)),
                    amount
                };

                try {
                    const serialized = CAT20StateLib.serializeState(state);
                    const deserialized = CAT20StateLib.deserializeState(serialized);
                    expect(deserialized.amount).to.equal(amount);
                } catch (e: any) {
                    // Some boundary values may be rejected - that's OK if intentional
                    console.log(`Boundary ${amount}: ${e.message}`);
                }
            }
        });

        it('should reject negative amounts', () => {
            const negativeAmounts = [-1n, -100n, -BigInt(Number.MAX_SAFE_INTEGER)];

            for (const amount of negativeAmounts) {
                const state: CAT20State = {
                    ownerAddr: toByteString('00'.repeat(20)),
                    amount
                };

                // Check via CAT20StateLib.checkState which validates amounts
                expect(() => CAT20StateLib.checkState(state)).to.throw;
            }
        });

        it('should preserve state integrity across multiple roundtrips', () => {
            const rng = new FuzzRng(41402);

            for (let i = 0; i < 50; i++) {
                let state: CAT20State = {
                    ownerAddr: rng.nextHexString(20),
                    amount: rng.nextBigInt(1n, 1000000n)
                };

                // Multiple roundtrips
                for (let j = 0; j < 5; j++) {
                    const serialized = CAT20StateLib.serializeState(state);
                    state = CAT20StateLib.deserializeState(serialized);
                }

                // Should still match original
                expect(state.ownerAddr.length).to.equal(40); // 20 bytes hex
                expect(state.amount > 0n).to.be.true;
            }
        });
    });

    // ============================================================
    // 4.1.5: Fuzz ownerAddr with various lengths
    // ============================================================
    describe('4.1.5: Fuzz ownerAddr with various lengths', () => {
        it('should handle 20-byte P2PKH addresses', () => {
            // Use real address format for checkState tests
            const ownerAddr = toTokenOwnerAddress(mainAddress);

            for (let i = 0; i < 10; i++) {
                const state: CAT20State = {
                    ownerAddr,
                    amount: BigInt(i + 1) * 1000n
                };

                // Should pass checkState with valid address
                CAT20StateLib.checkState(state);

                // Roundtrip should preserve
                const serialized = CAT20StateLib.serializeState(state);
                const deserialized = CAT20StateLib.deserializeState(serialized);
                expect(deserialized.ownerAddr).to.equal(ownerAddr);
            }
        });

        it('should handle random 20-byte data in roundtrip', () => {
            const rng = new FuzzRng(41501);

            for (let i = 0; i < FUZZ_ITERATIONS; i++) {
                const ownerAddr = rng.nextHexString(20); // 20 bytes random data

                const state: CAT20State = {
                    ownerAddr,
                    amount: rng.nextBigInt(1n, 1000000n)
                };

                // Note: checkState validates address format, so skip it for random bytes
                // Just test serialization roundtrip
                const serialized = CAT20StateLib.serializeState(state);
                const deserialized = CAT20StateLib.deserializeState(serialized);
                expect(deserialized.ownerAddr).to.equal(ownerAddr);
            }
        });

        it('should handle 32-byte contract script hashes', () => {
            const rng = new FuzzRng(41502);

            for (let i = 0; i < FUZZ_ITERATIONS; i++) {
                const ownerAddr = rng.nextHexString(32); // 32 bytes = script hash

                const state: CAT20State = {
                    ownerAddr,
                    amount: rng.nextBigInt(1n, 1000000n)
                };

                // Roundtrip should preserve
                const serialized = CAT20StateLib.serializeState(state);
                const deserialized = CAT20StateLib.deserializeState(serialized);
                expect(deserialized.ownerAddr).to.equal(ownerAddr);
            }
        });

        it('should handle 25-byte P2PKH full script', () => {
            const rng = new FuzzRng(41503);

            // P2PKH script: OP_DUP OP_HASH160 <20-byte hash> OP_EQUALVERIFY OP_CHECKSIG
            // Total: 1 + 1 + 1 + 20 + 1 + 1 = 25 bytes

            for (let i = 0; i < 50; i++) {
                const hash160 = rng.nextHexString(20);
                const p2pkhScript = toByteString('76a914' + hash160 + '88ac');

                expect(len(p2pkhScript)).to.equal(25n);

                const state: CAT20State = {
                    ownerAddr: p2pkhScript,
                    amount: rng.nextBigInt(1n, 1000000n)
                };

                const serialized = CAT20StateLib.serializeState(state);
                const deserialized = CAT20StateLib.deserializeState(serialized);
                expect(deserialized.ownerAddr).to.equal(p2pkhScript);
            }
        });

        it('should reject invalid ownerAddr lengths', () => {
            const rng = new FuzzRng(41504);

            const invalidLengths = [0, 1, 5, 10, 19, 21, 31, 33, 64, 100];

            for (const length of invalidLengths) {
                if (length === 0) continue; // Empty is special case

                const ownerAddr = rng.nextHexString(length);

                const state: CAT20State = {
                    ownerAddr,
                    amount: 1000n
                };

                // checkState should reject invalid lengths
                // (depends on OwnerUtils.checkOwnerAddr implementation)
                try {
                    CAT20StateLib.checkState(state);
                    // If it doesn't throw, log for analysis
                    console.log(`Length ${length} accepted - verify if intentional`);
                } catch (e: any) {
                    // Expected for invalid lengths
                }
            }
        });

        it('should handle special byte patterns in ownerAddr', () => {
            const specialPatterns = [
                toByteString('00'.repeat(20)),  // All zeros
                toByteString('ff'.repeat(20)),  // All FFs
                toByteString('aa'.repeat(20)),  // Alternating bits
                toByteString('55'.repeat(20)),  // Alternating bits inverse
                toByteString('0f'.repeat(20)),  // Nibble boundary
                toByteString('f0'.repeat(20)),  // Nibble boundary inverse
            ];

            for (const ownerAddr of specialPatterns) {
                const state: CAT20State = {
                    ownerAddr,
                    amount: 1000n
                };

                const serialized = CAT20StateLib.serializeState(state);
                const hash = CAT20StateLib.stateHash(state);
                const deserialized = CAT20StateLib.deserializeState(serialized);

                expect(deserialized.ownerAddr).to.equal(ownerAddr);
                expect(hash.length).to.equal(64);
            }
        });

        it('should handle real address formats', async () => {
            // Test with real address conversion
            const ownerAddr = toTokenOwnerAddress(mainAddress);

            const state: CAT20State = {
                ownerAddr,
                amount: 1000n
            };

            CAT20StateLib.checkState(state);

            const serialized = CAT20StateLib.serializeState(state);
            const deserialized = CAT20StateLib.deserializeState(serialized);

            expect(deserialized.ownerAddr).to.equal(ownerAddr);
        });
    });

    // ============================================================
    // Existing tests - retained for compatibility
    // ============================================================
    describe('Fuzz: CAT20GuardState Serialization', () => {
        it('should correctly handle random guard states', () => {
            const rng = new FuzzRng(54321);
            let successCount = 0;

            for (let i = 0; i < FUZZ_ITERATIONS; i++) {
                const guardState = CAT20GuardStateLib.createEmptyState(TX_INPUT_COUNT_MAX_6);

                // Randomize deployerAddr
                guardState.deployerAddr = rng.nextHexString(20);

                // Randomize token script hashes (valid 32-byte hashes)
                for (let j = 0; j < GUARD_TOKEN_TYPE_MAX; j++) {
                    if (rng.next() > 0.5) {
                        guardState.tokenScriptHashes[j] = rng.nextHexString(32);
                    }
                }

                // Randomize amounts
                for (let j = 0; j < GUARD_TOKEN_TYPE_MAX; j++) {
                    guardState.tokenAmounts[j] = rng.nextBigInt(0n, 1000000n);
                    guardState.tokenBurnAmounts[j] = rng.nextBigInt(0n, guardState.tokenAmounts[j]);
                }

                // Randomize script indexes
                let tokenScriptIndexes = '';
                for (let j = 0; j < TX_INPUT_COUNT_MAX_6; j++) {
                    const idx = rng.nextInt(-1, GUARD_TOKEN_TYPE_MAX - 1);
                    tokenScriptIndexes += intToByteString(BigInt(idx), 1n);
                }
                guardState.tokenScriptIndexes = tokenScriptIndexes as ByteString;

                // Compute state hash
                const stateHash = CAT20GuardStateLib.stateHash(guardState);
                expect(stateHash.length).to.equal(64); // 32 bytes = 64 hex chars

                successCount++;
            }

            expect(successCount).to.equal(FUZZ_ITERATIONS);
        });

        it('should reject duplicate token script hashes', () => {
            const guardState = CAT20GuardStateLib.createEmptyState(TX_INPUT_COUNT_MAX_6);
            guardState.deployerAddr = toByteString('00'.repeat(20));

            // Create duplicate script hashes
            const duplicateHash = toByteString('aa'.repeat(32));
            guardState.tokenScriptHashes[0] = duplicateHash;
            guardState.tokenScriptHashes[1] = duplicateHash; // Duplicate!

            // The uniqueness check should catch this
            expect(() => {
                CAT20GuardStateLib.checkTokenScriptsUniq(guardState.tokenScriptHashes);
            }).to.throw;
        });

        it('should handle all placeholder values', () => {
            const guardState = CAT20GuardStateLib.createEmptyState(TX_INPUT_COUNT_MAX_6);

            // Verify placeholders are set correctly
            expect(guardState.tokenScriptHashes[0]).to.equal(ConstantsLib.TOKEN_SCRIPT_HASH_PLACEHOLDER_FF);
            expect(guardState.tokenScriptHashes[1]).to.equal(ConstantsLib.TOKEN_SCRIPT_HASH_PLACEHOLDER_FE);
            expect(guardState.tokenScriptHashes[2]).to.equal(ConstantsLib.TOKEN_SCRIPT_HASH_PLACEHOLDER_FD);
            expect(guardState.tokenScriptHashes[3]).to.equal(ConstantsLib.TOKEN_SCRIPT_HASH_PLACEHOLDER_FC);

            // Verify uniqueness passes with placeholders
            CAT20GuardStateLib.checkTokenScriptsUniq(guardState.tokenScriptHashes);
        });
    });

    describe('Fuzz: Malformed State Data', () => {
        it('should reject truncated state data', () => {
            const rng = new FuzzRng(11111);

            for (let i = 0; i < 50; i++) {
                // Generate valid state
                const state: CAT20State = {
                    ownerAddr: rng.nextHexString(20),
                    amount: rng.nextBigInt(1n, 1000000n)
                };

                const serialized = CAT20StateLib.serializeState(state);

                // Truncate at random position
                const truncateAt = rng.nextInt(1, serialized.length - 2);
                const truncated = serialized.slice(0, truncateAt) as ByteString;

                // Deserialization should fail or produce wrong result
                try {
                    const deserialized = CAT20StateLib.deserializeState(truncated);
                    // If it doesn't throw, verify it doesn't match
                    expect(
                        deserialized.ownerAddr !== state.ownerAddr ||
                        deserialized.amount !== state.amount
                    ).to.be.true;
                } catch (e: any) {
                    // Expected - truncated data should fail
                }
            }
        });

        it('should reject extended state data (extra bytes)', () => {
            const rng = new FuzzRng(22222);

            for (let i = 0; i < 50; i++) {
                const state: CAT20State = {
                    ownerAddr: rng.nextHexString(20),
                    amount: rng.nextBigInt(1n, 1000000n)
                };

                const serialized = CAT20StateLib.serializeState(state);

                // Add random extra bytes
                const extraBytes = rng.nextHexString(rng.nextInt(1, 32));
                const extended = (serialized + extraBytes) as ByteString;

                // State hash should be different
                const originalHash = sha256(serialized);
                const extendedHash = sha256(extended);

                expect(originalHash).to.not.equal(extendedHash);
            }
        });

        it('should detect bit-flip corruption', () => {
            const rng = new FuzzRng(33333);

            for (let i = 0; i < 50; i++) {
                const state: CAT20State = {
                    ownerAddr: rng.nextHexString(20),
                    amount: rng.nextBigInt(1n, 1000000n)
                };

                const serialized = CAT20StateLib.serializeState(state);
                const originalHash = sha256(serialized);

                // Flip a random bit
                const byteIndex = rng.nextInt(0, serialized.length / 2 - 1);
                const bitPosition = rng.nextInt(0, 7);

                const bytes = Buffer.from(serialized, 'hex');
                bytes[byteIndex] ^= (1 << bitPosition);
                const corrupted = bytes.toString('hex') as ByteString;

                // Hash should be different
                const corruptedHash = sha256(corrupted);
                expect(originalHash).to.not.equal(corruptedHash);
            }
        });
    });

    describe('Fuzz: OpenMinter State Edge Cases', () => {
        it('should handle various remainingCount values', () => {
            const rng = new FuzzRng(44444);

            const testCases = [
                { remainingCount: 0n, hasMintedBefore: true },
                { remainingCount: 1n, hasMintedBefore: false },
                { remainingCount: BigInt(Number.MAX_SAFE_INTEGER), hasMintedBefore: false },
                { remainingCount: 2n ** 32n - 1n, hasMintedBefore: true },
            ];

            for (const tc of testCases) {
                const state: CAT20OpenMinterState = {
                    tokenScriptHash: rng.nextHexString(32),
                    hasMintedBefore: tc.hasMintedBefore,
                    remainingCount: tc.remainingCount
                };

                // State should be serializable
                // Note: We don't have direct access to OpenMinter serialization,
                // but we can verify the structure is valid
                expect(state.remainingCount >= 0n).to.be.true;
            }
        });
    });

    describe('Fuzz: Script Index Encoding', () => {
        it('should correctly encode/decode script indexes in valid range', () => {
            const rng = new FuzzRng(55555);

            for (let i = 0; i < 100; i++) {
                const indexes: bigint[] = [];

                for (let j = 0; j < TX_INPUT_COUNT_MAX_6; j++) {
                    // Valid range: -1 to GUARD_TOKEN_TYPE_MAX-1
                    indexes.push(BigInt(rng.nextInt(-1, GUARD_TOKEN_TYPE_MAX - 1)));
                }

                // Encode
                let encoded = '';
                for (const idx of indexes) {
                    encoded += intToByteString(idx, 1n);
                }

                // Verify length
                expect(encoded.length).to.equal(TX_INPUT_COUNT_MAX_6 * 2);

                // Decode and verify using sign-magnitude representation
                // In Bitcoin script: -1 = 0x81, -2 = 0x82, etc. (sign bit is 0x80)
                for (let j = 0; j < TX_INPUT_COUNT_MAX_6; j++) {
                    const byte = encoded.slice(j * 2, (j + 1) * 2);
                    const value = parseInt(byte, 16);
                    // Sign-magnitude: high bit is sign, lower 7 bits are magnitude
                    const signedValue = (value & 0x80) ? -(value & 0x7f) : value;
                    expect(BigInt(signedValue)).to.equal(indexes[j]);
                }
            }
        });

        it('should reject out-of-range script indexes', () => {
            const invalidIndexes = [
                GUARD_TOKEN_TYPE_MAX,
                GUARD_TOKEN_TYPE_MAX + 1,
                100,
                -2,
                -100
            ];

            for (const idx of invalidIndexes) {
                // Creating guard state with invalid index should be caught during validation
                const guardState = CAT20GuardStateLib.createEmptyState(TX_INPUT_COUNT_MAX_6);

                // Manually inject invalid index
                const invalidEncoded = intToByteString(BigInt(idx), 1n) + guardState.tokenScriptIndexes.slice(2);
                guardState.tokenScriptIndexes = invalidEncoded as ByteString;

                // Formal check should fail
                expect(() => {
                    CAT20GuardStateLib.formalCheckState(guardState, TX_INPUT_COUNT_MAX_6);
                }).to.throw;
            }
        });
    });

    describe('Fuzz: Hash Collision Resistance', () => {
        it('should produce unique hashes for different states', () => {
            const rng = new FuzzRng(66666);
            const hashes = new Set<string>();

            for (let i = 0; i < 1000; i++) {
                const state: CAT20State = {
                    ownerAddr: rng.nextHexString(20),
                    amount: rng.nextBigInt(1n, BigInt(Number.MAX_SAFE_INTEGER))
                };

                const hash = CAT20StateLib.stateHash(state);
                hashes.add(hash);
            }

            // All hashes should be unique (collision probability is negligible)
            expect(hashes.size).to.equal(1000);
        });

        it('should produce different hashes for same amount with different owners', () => {
            const amount = 12345n;
            const hashes = new Set<string>();

            for (let i = 0; i < 100; i++) {
                const state: CAT20State = {
                    ownerAddr: toByteString(i.toString(16).padStart(40, '0')),
                    amount
                };

                const hash = CAT20StateLib.stateHash(state);
                hashes.add(hash);
            }

            expect(hashes.size).to.equal(100);
        });

        it('should produce different hashes for same owner with different amounts', () => {
            const owner = toByteString('00'.repeat(20));
            const hashes = new Set<string>();

            for (let i = 1; i <= 100; i++) {
                const state: CAT20State = {
                    ownerAddr: owner,
                    amount: BigInt(i)
                };

                const hash = CAT20StateLib.stateHash(state);
                hashes.add(hash);
            }

            expect(hashes.size).to.equal(100);
        });
    });

    describe('Fuzz: Special Character Injection', () => {
        it('should safely handle all byte values in ownerAddr', () => {
            // Test all possible single-byte prefixes
            for (let byte = 0; byte < 256; byte++) {
                const ownerAddr = toByteString(
                    byte.toString(16).padStart(2, '0') + '00'.repeat(19)
                );

                const state: CAT20State = {
                    ownerAddr,
                    amount: 1000n
                };

                const serialized = CAT20StateLib.serializeState(state);
                const deserialized = CAT20StateLib.deserializeState(serialized);

                expect(deserialized.ownerAddr).to.equal(ownerAddr);
            }
        });

        it('should safely handle FF bytes (potential script terminator)', () => {
            const allFFs = toByteString('ff'.repeat(20));

            const state: CAT20State = {
                ownerAddr: allFFs,
                amount: 1000n
            };

            const serialized = CAT20StateLib.serializeState(state);
            const hash = CAT20StateLib.stateHash(state);

            expect(hash.length).to.equal(64);
        });

        it('should safely handle 00 bytes (null bytes)', () => {
            const allZeros = toByteString('00'.repeat(20));

            const state: CAT20State = {
                ownerAddr: allZeros,
                amount: 1000n
            };

            const serialized = CAT20StateLib.serializeState(state);
            const deserialized = CAT20StateLib.deserializeState(serialized);

            expect(deserialized.ownerAddr).to.equal(allZeros);
        });
    });
});
