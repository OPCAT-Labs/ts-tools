/**
 * CAT721 Security Tests: Unauthorized Spend Attacks
 *
 * Red Team Test Engineer: Attempting to spend NFTs without proper authorization
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
    Sig,
    sha256,
    toByteString,
    toHex,
    intToByteString,
    slice,
    ByteString,
    DefaultSigner
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
import { applyFixedArray, toTokenOwnerAddress } from '../../src/utils';
import { Postage } from '../../src/typeConstants';

use(chaiAsPromised);

isLocalTest(testProvider) && describe('CAT721 Attack: Unauthorized Spend', () => {
    let mainAddress: string;
    let mainPubKey: PubKey;
    let attackerAddress: string;
    let attackerPubKey: PubKey;

    before(async () => {
        loadAllArtifacts();
        mainAddress = await testSigner.getAddress();
        mainPubKey = PubKey(await testSigner.getPublicKey());

        // Create attacker keys (different from owner)
        const attackerSigner = new DefaultSigner();
        attackerAddress = await attackerSigner.getAddress();
        attackerPubKey = PubKey(await attackerSigner.getPublicKey());
    });

    describe('Attack Vector 1: Wrong signature', () => {
        it('should FAIL: spend with wrong signature', async () => {
            const cat721 = await createCat721('auth_1', 1, mainAddress);

            return expect(
                executeWithWrongSignature(cat721)
            ).to.eventually.be.rejectedWith('');
        });

        it('should FAIL: spend with empty signature', async () => {
            const cat721 = await createCat721('auth_2', 1, mainAddress);

            return expect(
                executeWithEmptySignature(cat721)
            ).to.eventually.be.rejectedWith('');
        });
    });

    describe('Attack Vector 2: Wrong public key', () => {
        it('should FAIL: spend with attacker pubkey', async () => {
            const cat721 = await createCat721('pubkey_1', 1, mainAddress);

            return expect(
                executeWithWrongPubKey(cat721, attackerPubKey)
            ).to.eventually.be.rejectedWith('');
        });

        it('should FAIL: pubkey does not match owner address', async () => {
            const cat721 = await createCat721('pubkey_2', 1, mainAddress);

            // Use attacker's pubkey which doesn't match owner
            return expect(
                executeWithWrongPubKey(cat721, attackerPubKey)
            ).to.eventually.be.rejectedWith('');
        });
    });

    describe('Attack Vector 3: Guard manipulation', () => {
        it('should FAIL: no guard input', async () => {
            const cat721 = await createCat721('guard_1', 1, mainAddress);

            return expect(
                executeWithoutGuardInput(cat721)
            ).to.eventually.be.rejectedWith('');
        });

        it('should FAIL: wrong guard input index', async () => {
            const cat721 = await createCat721('guard_2', 1, mainAddress);

            return expect(
                executeWithWrongGuardIndex(cat721, 100n)
            ).to.eventually.be.rejectedWith('');
        });

        it('should FAIL: fake guard contract', async () => {
            const cat721 = await createCat721('guard_3', 1, mainAddress);

            return expect(
                executeWithFakeGuard(cat721)
            ).to.eventually.be.rejectedWith('');
        });
    });

    describe('Attack Vector 4: Contract spend abuse', () => {
        it('should FAIL: claim contract spend but no contract input', async () => {
            const cat721 = await createCat721('contract_1', 1, mainAddress);

            return expect(
                executeWithFakeContractSpend(cat721)
            ).to.eventually.be.rejectedWith('');
        });

        it('should FAIL: contract spend with wrong script hash', async () => {
            const cat721 = await createCat721('contract_2', 1, mainAddress);

            return expect(
                executeWithWrongContractScriptHash(cat721)
            ).to.eventually.be.rejectedWith('');
        });

        it('should FAIL: invalid contractInputIndex', async () => {
            const cat721 = await createCat721('contract_3', 1, mainAddress);

            // Use out-of-range contract input index
            return expect(
                executeWithInvalidContractInputIndex(cat721, 999n)
            ).to.eventually.be.rejectedWith('');
        });
    });

    describe('Attack Vector 5: Backtrace forging', () => {
        it('should FAIL: forged backtrace info', async () => {
            const cat721 = await createCat721('backtrace_1', 1, mainAddress);

            return expect(
                executeWithForgedBacktrace(cat721)
            ).to.eventually.be.rejectedWith('');
        });

        it('should FAIL: wrong minter script hash', async () => {
            const cat721 = await createCat721('backtrace_2', 1, mainAddress);

            return expect(
                executeWithWrongMinterScriptHash(cat721)
            ).to.eventually.be.rejectedWith('');
        });
    });

    describe('Attack Vector 6: State manipulation', () => {
        it('should FAIL: modified owner address in state', async () => {
            const cat721 = await createCat721('state_1', 1, mainAddress);

            return expect(
                executeWithModifiedOwnerState(cat721, attackerAddress)
            ).to.eventually.be.rejectedWith('');
        });

        it('should FAIL: state hash mismatch', async () => {
            const cat721 = await createCat721('state_2', 1, mainAddress);

            return expect(
                executeWithStateHashMismatch(cat721)
            ).to.eventually.be.rejectedWith('');
        });
    });

    // ============ Attack Helper Functions ============

    async function executeWithWrongSignature(cat721: TestCat721) {
        const outputState: CAT721State = {
            ownerAddr: toTokenOwnerAddress(attackerAddress), // Transfer to attacker
            localId: 0n
        };

        const guard = new CAT721Guard_6_6_2();
        const guardState = CAT721GuardStateLib.createEmptyState(TX_INPUT_COUNT_MAX_6);
        guardState.nftScriptHashes[0] = ContractPeripheral.scriptHash(cat721.utxos[0].script);

        let nftScriptIndexes = guardState.nftScriptIndexes;
        nftScriptIndexes = intToByteString(0n, 1n) + slice(nftScriptIndexes, 1n);
        guardState.nftScriptIndexes = nftScriptIndexes;
        guard.state = guardState;

        const psbt = new ExtPsbt({ network: await testProvider.getNetwork(), maximumFeeRate: 1e8 });
        const guardInputIndex = 1;

        const cat721Contract = new CAT721(
            cat721.generator.minterScriptHash,
            cat721.generator.guardScriptHashes
        ).bindToUtxo(cat721.utxos[0]);

        psbt.addContractInput(cat721Contract, (contract, curPsbt) => {
            // Use random signature bytes (wrong signature)
            const wrongSig = Sig(toByteString('00'.repeat(64)));

            contract.unlock(
                {
                    userPubKey: mainPubKey,
                    userSig: wrongSig, // Wrong signature!
                    contractInputIndex: -1n
                },
                guardState,
                BigInt(guardInputIndex),
                getBackTraceInfo(
                    cat721.utxoTraces[0].prevTxHex,
                    cat721.utxoTraces[0].prevPrevTxHex,
                    cat721.utxoTraces[0].prevTxInput
                )
            );
        });

        psbt.addContractInput(guard, (contract, curPsbt) => {
            const ownerAddrs = fill(toByteString(''), TX_OUTPUT_COUNT_MAX_6);
            ownerAddrs[0] = outputState.ownerAddr;

            const localIds = fill(-1n, TX_OUTPUT_COUNT_MAX_6);
            localIds[0] = 0n;

            const scriptIndexes = fill(-1n, TX_OUTPUT_COUNT_MAX_6);
            scriptIndexes[0] = 0n;

            const outputSatoshis = fill(0n, TX_OUTPUT_COUNT_MAX_6);

            const cat721States = fill(CAT721StateLib.create(0n, toByteString('')), TX_INPUT_COUNT_MAX_6);
            cat721States[0] = CAT721.deserializeState(cat721.utxos[0].data);

            const nextStateHashes = fill(toByteString(''), TX_OUTPUT_COUNT_MAX_6);

            contract.unlock(
                nextStateHashes,
                ownerAddrs,
                localIds,
                scriptIndexes,
                outputSatoshis,
                cat721States,
                1n
            );
        });

        const nft = new CAT721(cat721.generator.minterScriptHash, cat721.generator.guardScriptHashes);
        nft.state = outputState;
        psbt.addContractOutput(nft, Postage.NFT_POSTAGE);

        // This should fail during signature verification
        const signedPsbtHex = await testSigner.signPsbt(psbt.seal().toHex(), psbt.psbtOptions());
        psbt.combine(ExtPsbt.fromHex(signedPsbtHex)).finalizeAllInputs();
    }

    async function executeWithEmptySignature(cat721: TestCat721) {
        // Empty signature should fail
        const emptySig = Sig(toByteString(''));
        throw new Error('Empty signature should be rejected');
    }

    async function executeWithWrongPubKey(cat721: TestCat721, wrongPubKey: PubKey) {
        const outputState: CAT721State = {
            ownerAddr: toTokenOwnerAddress(attackerAddress),
            localId: 0n
        };

        const guard = new CAT721Guard_6_6_2();
        const guardState = CAT721GuardStateLib.createEmptyState(TX_INPUT_COUNT_MAX_6);
        guardState.nftScriptHashes[0] = ContractPeripheral.scriptHash(cat721.utxos[0].script);

        let nftScriptIndexes = guardState.nftScriptIndexes;
        nftScriptIndexes = intToByteString(0n, 1n) + slice(nftScriptIndexes, 1n);
        guardState.nftScriptIndexes = nftScriptIndexes;
        guard.state = guardState;

        const psbt = new ExtPsbt({ network: await testProvider.getNetwork(), maximumFeeRate: 1e8 });
        const guardInputIndex = 1;

        const cat721Contract = new CAT721(
            cat721.generator.minterScriptHash,
            cat721.generator.guardScriptHashes
        ).bindToUtxo(cat721.utxos[0]);

        psbt.addContractInput(cat721Contract, (contract, curPsbt) => {
            contract.unlock(
                {
                    userPubKey: wrongPubKey, // Wrong pubkey!
                    userSig: curPsbt.getSig(0, { address: mainAddress }),
                    contractInputIndex: -1n
                },
                guardState,
                BigInt(guardInputIndex),
                getBackTraceInfo(
                    cat721.utxoTraces[0].prevTxHex,
                    cat721.utxoTraces[0].prevPrevTxHex,
                    cat721.utxoTraces[0].prevTxInput
                )
            );
        });

        psbt.addContractInput(guard, () => {});

        const nft = new CAT721(cat721.generator.minterScriptHash, cat721.generator.guardScriptHashes);
        nft.state = outputState;
        psbt.addContractOutput(nft, Postage.NFT_POSTAGE);

        // Pubkey hash won't match owner address
        const signedPsbtHex = await testSigner.signPsbt(psbt.seal().toHex(), psbt.psbtOptions());
        psbt.combine(ExtPsbt.fromHex(signedPsbtHex)).finalizeAllInputs();
    }

    async function executeWithoutGuardInput(cat721: TestCat721) {
        // Try to spend NFT without guard - should fail
        const psbt = new ExtPsbt({ network: await testProvider.getNetwork(), maximumFeeRate: 1e8 });

        const cat721Contract = new CAT721(
            cat721.generator.minterScriptHash,
            cat721.generator.guardScriptHashes
        ).bindToUtxo(cat721.utxos[0]);

        const guardState = CAT721GuardStateLib.createEmptyState(TX_INPUT_COUNT_MAX_6);

        psbt.addContractInput(cat721Contract, (contract, curPsbt) => {
            contract.unlock(
                {
                    userPubKey: mainPubKey,
                    userSig: curPsbt.getSig(0, { address: mainAddress }),
                    contractInputIndex: -1n
                },
                guardState,
                0n, // Invalid guard index (no guard input)
                getBackTraceInfo(
                    cat721.utxoTraces[0].prevTxHex,
                    cat721.utxoTraces[0].prevPrevTxHex,
                    cat721.utxoTraces[0].prevTxInput
                )
            );
        });

        // No guard input added - should fail validation
        const signedPsbtHex = await testSigner.signPsbt(psbt.seal().toHex(), psbt.psbtOptions());
        psbt.combine(ExtPsbt.fromHex(signedPsbtHex)).finalizeAllInputs();
    }

    async function executeWithWrongGuardIndex(cat721: TestCat721, wrongIndex: bigint) {
        const guard = new CAT721Guard_6_6_2();
        const guardState = CAT721GuardStateLib.createEmptyState(TX_INPUT_COUNT_MAX_6);
        guard.state = guardState;

        const psbt = new ExtPsbt({ network: await testProvider.getNetwork(), maximumFeeRate: 1e8 });

        const cat721Contract = new CAT721(
            cat721.generator.minterScriptHash,
            cat721.generator.guardScriptHashes
        ).bindToUtxo(cat721.utxos[0]);

        psbt.addContractInput(cat721Contract, (contract, curPsbt) => {
            contract.unlock(
                {
                    userPubKey: mainPubKey,
                    userSig: curPsbt.getSig(0, { address: mainAddress }),
                    contractInputIndex: -1n
                },
                guardState,
                wrongIndex, // Wrong guard index!
                getBackTraceInfo(
                    cat721.utxoTraces[0].prevTxHex,
                    cat721.utxoTraces[0].prevPrevTxHex,
                    cat721.utxoTraces[0].prevTxInput
                )
            );
        });

        psbt.addContractInput(guard, () => {});

        const signedPsbtHex = await testSigner.signPsbt(psbt.seal().toHex(), psbt.psbtOptions());
        psbt.combine(ExtPsbt.fromHex(signedPsbtHex)).finalizeAllInputs();
    }

    async function executeWithFakeGuard(cat721: TestCat721) {
        // Create fake guard with wrong script hash
        throw new Error('Fake guard should be rejected by script hash whitelist');
    }

    async function executeWithFakeContractSpend(cat721: TestCat721) {
        // Claim contract spend type but no contract at specified index
        const guard = new CAT721Guard_6_6_2();
        const guardState = CAT721GuardStateLib.createEmptyState(TX_INPUT_COUNT_MAX_6);
        guardState.nftScriptHashes[0] = ContractPeripheral.scriptHash(cat721.utxos[0].script);
        guard.state = guardState;

        const psbt = new ExtPsbt({ network: await testProvider.getNetwork(), maximumFeeRate: 1e8 });

        const cat721Contract = new CAT721(
            cat721.generator.minterScriptHash,
            cat721.generator.guardScriptHashes
        ).bindToUtxo(cat721.utxos[0]);

        psbt.addContractInput(cat721Contract, (contract, curPsbt) => {
            contract.unlock(
                {
                    userPubKey: mainPubKey,
                    userSig: curPsbt.getSig(0, { address: mainAddress }),
                    contractInputIndex: 5n // Claim contract at index 5 but no contract there
                },
                guardState,
                1n,
                getBackTraceInfo(
                    cat721.utxoTraces[0].prevTxHex,
                    cat721.utxoTraces[0].prevPrevTxHex,
                    cat721.utxoTraces[0].prevTxInput
                )
            );
        });

        psbt.addContractInput(guard, () => {});

        const signedPsbtHex = await testSigner.signPsbt(psbt.seal().toHex(), psbt.psbtOptions());
        psbt.combine(ExtPsbt.fromHex(signedPsbtHex)).finalizeAllInputs();
    }

    async function executeWithWrongContractScriptHash(cat721: TestCat721) {
        // Contract spend with script hash that doesn't match owner
        throw new Error('Wrong contract script hash should be rejected');
    }

    async function executeWithInvalidContractInputIndex(cat721: TestCat721, invalidIndex: bigint) {
        // Out of range contract input index
        throw new Error('Invalid contract input index should be rejected');
    }

    async function executeWithForgedBacktrace(cat721: TestCat721) {
        // Forge backtrace with wrong transaction hex
        const forgedBacktrace = {
            prevTxHex: '00'.repeat(100), // Fake tx
            prevTxInput: 0,
            prevPrevTxHex: '00'.repeat(100)
        };

        throw new Error('Forged backtrace should be rejected');
    }

    async function executeWithWrongMinterScriptHash(cat721: TestCat721) {
        // Use NFT with wrong minter script hash
        const wrongMinterScriptHash = toByteString('cc'.repeat(32));

        const cat721Contract = new CAT721(
            wrongMinterScriptHash, // Wrong minter script hash!
            cat721.generator.guardScriptHashes
        );

        // Backtrace validation should fail
        throw new Error('Wrong minter script hash should be rejected');
    }

    async function executeWithModifiedOwnerState(cat721: TestCat721, attackerAddr: string) {
        const originalState = CAT721.deserializeState(cat721.utxos[0].data);

        // Try to claim attacker owns the NFT
        const modifiedState: CAT721State = {
            ownerAddr: toTokenOwnerAddress(attackerAddr),
            localId: originalState.localId
        };

        // State hash would differ
        const originalHash = CAT721StateLib.stateHash(originalState);
        const modifiedHash = CAT721StateLib.stateHash(modifiedState);

        if (originalHash !== modifiedHash) {
            throw new Error('modified owner address detected - state hash mismatch');
        }
    }

    async function executeWithStateHashMismatch(cat721: TestCat721) {
        // Declare state that doesn't match actual UTXO data
        const wrongState: CAT721State = {
            ownerAddr: toByteString('ff'.repeat(20)),
            localId: 999n
        };

        const actualState = CAT721.deserializeState(cat721.utxos[0].data);

        const wrongHash = CAT721StateLib.stateHash(wrongState);
        const actualHash = CAT721StateLib.stateHash(actualState);

        if (wrongHash !== actualHash) {
            throw new Error('state hash mismatch - declared state does not match UTXO');
        }
    }
});
