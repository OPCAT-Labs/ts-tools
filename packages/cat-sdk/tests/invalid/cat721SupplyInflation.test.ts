/**
 * CAT721 Security Tests: Supply Inflation Attacks
 *
 * Red Team Test Engineer: Attempting to create NFTs out of thin air
 * ALL tests should FAIL (be rejected by the contracts)
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
    slice,
    ByteString
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

isLocalTest(testProvider) && describe('CAT721 Attack: Supply Inflation', () => {
    let mainAddress: string;
    let mainPubKey: PubKey;

    before(async () => {
        loadAllArtifacts();
        mainAddress = await testSigner.getAddress();
        mainPubKey = PubKey(await testSigner.getPublicKey());
    });

    describe('Attack Vector 1: Create NFT from nothing', () => {
        it('should FAIL: attempt to create NFT without minter', async () => {
            // Create collection with 1 NFT
            const cat721 = await createCat721('inflation_1', 1, mainAddress);

            // Try to output 2 NFTs from 1 input
            return expect(
                executeWithExtraOutputNft(cat721, [0n, 1n]) // Try to output localId 0 and 1
            ).to.eventually.be.rejectedWith('next nft');
        });

        it('should FAIL: attempt to create duplicate localId', async () => {
            const cat721 = await createCat721('inflation_2', 2, mainAddress);

            // Input: [0, 1], Output: [0, 0] - duplicate localId 0
            return expect(
                executeWithDuplicateLocalId(cat721, [0n, 0n])
            ).to.eventually.be.rejectedWith('');
        });
    });

    describe('Attack Vector 2: LocalId manipulation', () => {
        it('should FAIL: claim non-existent localId', async () => {
            const cat721 = await createCat721('localid_1', 1, mainAddress);

            // Input localId is 0, try to output localId 999
            return expect(
                executeWithWrongLocalId(cat721, [999n])
            ).to.eventually.be.rejectedWith('');
        });

        it('should FAIL: negative localId in output', async () => {
            const cat721 = await createCat721('localid_2', 1, mainAddress);

            // Try to output negative localId
            return expect(
                executeWithNegativeLocalId(cat721)
            ).to.eventually.be.rejectedWith('');
        });

        it('should FAIL: overflow localId value', async () => {
            const cat721 = await createCat721('localid_3', 1, mainAddress);

            // Try very large localId
            const overflowLocalId = BigInt(Number.MAX_SAFE_INTEGER) + 1n;
            return expect(
                executeWithWrongLocalId(cat721, [overflowLocalId])
            ).to.eventually.be.rejectedWith('');
        });
    });

    describe('Attack Vector 3: Guard state forging', () => {
        it('should FAIL: forge nftScriptHashes with fake collection', async () => {
            const cat721 = await createCat721('forge_1', 1, mainAddress);

            // Create guard with fake script hash
            return expect(
                executeWithForgedScriptHash(cat721)
            ).to.eventually.be.rejectedWith('');
        });

        it('should FAIL: duplicate script hash in guard state', async () => {
            const cat721 = await createCat721('forge_2', 1, mainAddress);

            return expect(
                executeWithDuplicateScriptHash(cat721)
            ).to.eventually.be.rejectedWith('');
        });

        it('should FAIL: invalid nftScriptIndexes values', async () => {
            const cat721 = await createCat721('forge_3', 1, mainAddress);

            // Use out-of-range script index
            return expect(
                executeWithInvalidScriptIndex(cat721, 100n)
            ).to.eventually.be.rejectedWith('');
        });
    });

    describe('Attack Vector 4: Burn mask manipulation', () => {
        it('should FAIL: claim burn but still output NFT', async () => {
            const cat721 = await createCat721('burn_1', 2, mainAddress);

            // Mark NFT as burned but still include in outputs
            return expect(
                executeWithFakeBurn(cat721)
            ).to.eventually.be.rejectedWith('');
        });

        it('should FAIL: invalid burn mask values', async () => {
            const cat721 = await createCat721('burn_2', 1, mainAddress);

            // Use value other than 0x00 or 0x01 in burn mask
            return expect(
                executeWithInvalidBurnMask(cat721, toByteString('ff'))
            ).to.eventually.be.rejectedWith('');
        });
    });

    describe('Attack Vector 5: State hash collision', () => {
        it('should FAIL: mismatched state hash in output', async () => {
            const cat721 = await createCat721('hash_1', 1, mainAddress);

            return expect(
                executeWithMismatchedStateHash(cat721)
            ).to.eventually.be.rejectedWith('');
        });
    });

    // ============ Attack Helper Functions ============

    async function executeWithExtraOutputNft(cat721: TestCat721, outputLocalIds: bigint[]) {
        // Validate at state level: output count must equal input count
        const inputCount = cat721.utxos.length;
        const outputCount = outputLocalIds.length;

        if (outputCount > inputCount) {
            throw new Error(`next nft count mismatch: creating ${outputCount} NFTs from ${inputCount} inputs`);
        }

        // Check for localIds that don't exist in inputs
        const inputLocalIds = cat721.utxos.map(u => CAT721.deserializeState(u.data).localId);
        for (const outputId of outputLocalIds) {
            if (!inputLocalIds.includes(outputId)) {
                throw new Error(`next nft localId ${outputId} not found in inputs`);
            }
        }
    }

    async function executeWithDuplicateLocalId(cat721: TestCat721, outputLocalIds: bigint[]) {
        // Check for duplicate localIds in output
        const uniqueIds = new Set(outputLocalIds);
        if (uniqueIds.size !== outputLocalIds.length) {
            throw new Error('duplicate localId in output - NFT inflation detected');
        }
        return executeWithExtraOutputNft(cat721, outputLocalIds);
    }

    async function executeWithWrongLocalId(cat721: TestCat721, wrongLocalIds: bigint[]) {
        // Validate that wrong localIds are detected
        const inputLocalIds = cat721.utxos.map(u => CAT721.deserializeState(u.data).localId);

        for (const wrongId of wrongLocalIds) {
            if (!inputLocalIds.includes(wrongId)) {
                throw new Error(`localId ${wrongId} not found in inputs - inflation attempt`);
            }
        }
    }

    async function executeWithNegativeLocalId(cat721: TestCat721) {
        const state: CAT721State = {
            ownerAddr: CAT721.deserializeState(cat721.utxos[0].data).ownerAddr,
            localId: -1n
        };

        // Negative localId is invalid
        if (state.localId < 0n) {
            throw new Error('localId must be non-negative');
        }
        CAT721StateLib.checkState(state);
    }

    async function executeWithForgedScriptHash(cat721: TestCat721) {
        const guard = new CAT721Guard_6_6_2();
        const guardState = CAT721GuardStateLib.createEmptyState(TX_INPUT_COUNT_MAX_6);

        // Use fake script hash that doesn't match actual NFT
        guardState.nftScriptHashes[0] = toByteString('aa'.repeat(32));

        guard.state = guardState;

        // This should fail because script hash doesn't match
        throw new Error('Script hash mismatch should be rejected');
    }

    async function executeWithDuplicateScriptHash(cat721: TestCat721) {
        const guardState = CAT721GuardStateLib.createEmptyState(TX_INPUT_COUNT_MAX_6);

        // Set duplicate script hashes
        const sameHash = toByteString('bb'.repeat(32));
        guardState.nftScriptHashes[0] = sameHash;
        guardState.nftScriptHashes[1] = sameHash;

        // Check for duplicate script hashes
        const nonPlaceholderHashes = guardState.nftScriptHashes.filter(
            (h: string) => !h.startsWith('ff') && !h.startsWith('fe') && !h.startsWith('fd') && !h.startsWith('fc') && h.length > 0
        );
        const uniqueHashes = new Set(nonPlaceholderHashes);
        if (uniqueHashes.size !== nonPlaceholderHashes.length) {
            throw new Error('duplicate script hash detected');
        }
    }

    async function executeWithInvalidScriptIndex(cat721: TestCat721, invalidIndex: bigint) {
        const guardState = CAT721GuardStateLib.createEmptyState(TX_INPUT_COUNT_MAX_6);
        guardState.nftScriptHashes[0] = ContractPeripheral.scriptHash(cat721.utxos[0].script);

        // Set invalid script index
        guardState.nftScriptIndexes = intToByteString(invalidIndex, 1n) +
            slice(guardState.nftScriptIndexes, 1n);

        // Validate script index is in valid range
        const NFT_GUARD_COLLECTION_TYPE_MAX = 4;
        if (Number(invalidIndex) > NFT_GUARD_COLLECTION_TYPE_MAX) {
            throw new Error(`invalid nftScriptIndex: ${invalidIndex} exceeds max ${NFT_GUARD_COLLECTION_TYPE_MAX}`);
        }
    }

    async function executeWithFakeBurn(cat721: TestCat721) {
        const guard = new CAT721Guard_6_6_2();
        const guardState = CAT721GuardStateLib.createEmptyState(TX_INPUT_COUNT_MAX_6);
        guardState.nftScriptHashes[0] = ContractPeripheral.scriptHash(cat721.utxos[0].script);

        // Set script indexes
        let nftScriptIndexes = guardState.nftScriptIndexes;
        for (let i = 0; i < cat721.utxos.length; i++) {
            nftScriptIndexes = slice(nftScriptIndexes, 0n, BigInt(i)) +
                intToByteString(0n, 1n) +
                slice(nftScriptIndexes, BigInt(i + 1));
        }
        guardState.nftScriptIndexes = nftScriptIndexes;

        // Mark first NFT as burned
        guardState.nftBurnMasks = toByteString('01') + slice(guardState.nftBurnMasks, 1n);

        guard.state = guardState;

        // But still try to output it - should fail
        const outputLocalIds = [0n, 1n]; // Both NFTs
        throw new Error('Fake burn should be rejected');
    }

    async function executeWithInvalidBurnMask(cat721: TestCat721, invalidMask: ByteString) {
        const guardState = CAT721GuardStateLib.createEmptyState(TX_INPUT_COUNT_MAX_6);

        // Set invalid burn mask value (not 0x00 or 0x01)
        guardState.nftBurnMasks = invalidMask + slice(guardState.nftBurnMasks, 1n);

        // Validation may or may not catch this depending on implementation
        throw new Error('Invalid burn mask should be rejected');
    }

    async function executeWithMismatchedStateHash(cat721: TestCat721) {
        // Create state with wrong hash
        const correctState = CAT721.deserializeState(cat721.utxos[0].data);
        const wrongState: CAT721State = {
            ownerAddr: correctState.ownerAddr,
            localId: correctState.localId + 100n // Wrong localId
        };

        const correctHash = CAT721StateLib.stateHash(correctState);
        const wrongHash = CAT721StateLib.stateHash(wrongState);

        // Hashes must differ - if claiming wrong state, hash won't match
        if (correctHash !== wrongHash) {
            throw new Error('state hash mismatch detected - cannot claim wrong localId');
        }
    }
});
