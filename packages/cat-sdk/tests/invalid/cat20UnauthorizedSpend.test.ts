/**
 * CAT20 Unauthorized Spend Attack Tests
 *
 * Red Team Test Engineer: Attempting to spend tokens without authorization
 * All tests should FAIL (be rejected) - demonstrating CAT20 ownership security
 */

import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { isLocalTest } from '../utils';
import { testProvider } from '../utils/testProvider';
import { loadAllArtifacts } from '../features/cat20/utils';
import {
    ExtPsbt,
    fill,
    getBackTraceInfo,
    PubKey,
    sha256,
    toByteString,
    toHex,
    uint8ArrayToHex,
    slice,
    intToByteString,
    Signer,
    DefaultSigner,
    Script,
    Transaction,
    UTXO
} from '@opcat-labs/scrypt-ts-opcat';
import { testSigner } from '../utils/testSigner';
import { createCat20, TestCat20 } from '../utils/testCAT20Generator';
import {
    CAT20,
    CAT20State,
    CAT20StateLib,
    CAT20GuardStateLib,
    TX_INPUT_COUNT_MAX_6,
    TX_OUTPUT_COUNT_MAX_6
} from '../../src/contracts';
import { ContractPeripheral, CAT20GuardPeripheral } from '../../src/utils/contractPeripheral';
import { applyFixedArray, getDummyUtxo, toTokenOwnerAddress } from '../../src/utils';
import { Postage } from '../../src/typeConstants';

use(chaiAsPromised);

isLocalTest(testProvider) && describe('CAT20 Unauthorized Spend Attack Tests', () => {
    let ownerAddress: string;
    let ownerPubKey: PubKey;
    let attackerSigner: Signer;
    let attackerAddress: string;
    let attackerPubKey: PubKey;

    before(async () => {
        loadAllArtifacts();
        ownerAddress = await testSigner.getAddress();
        ownerPubKey = PubKey(await testSigner.getPublicKey());
        attackerSigner = new DefaultSigner();
        attackerAddress = await attackerSigner.getAddress();
        attackerPubKey = PubKey(await attackerSigner.getPublicKey());
    });

    describe('Attack Vector 1: Wrong Signature', () => {
        it('should FAIL: spend with wrong private key signature', async () => {
            const cat20 = await createCat20([1000n], ownerAddress, 'wrong_sig');

            // Must be rejected - signature validation will fail
            return expect(
                spendWithWrongSignature(cat20, attackerSigner, ownerPubKey)
            ).to.eventually.be.rejected;
        });

        it('should FAIL: spend with attacker pubkey and attacker sig (ownership mismatch)', async () => {
            const cat20 = await createCat20([1000n], ownerAddress, 'attacker_keys');

            // Must be rejected - ownership mismatch
            return expect(
                spendWithAttackerKeys(cat20, attackerSigner, attackerPubKey, attackerAddress)
            ).to.eventually.be.rejected;
        });

        it('should FAIL: replay signature from different transaction', async () => {
            const cat20 = await createCat20([1000n], ownerAddress, 'replay_sig');

            // Get a valid signature for one transaction
            const validSig = await getValidSignatureForDifferentTx(cat20);

            // Must be rejected - replayed signature won't match
            return expect(
                spendWithReplayedSignature(cat20, validSig)
            ).to.eventually.be.rejected;
        });
    });

    describe('Attack Vector 2: Pubkey Hash Mismatch', () => {
        it('should FAIL: use different pubkey claiming same address', async () => {
            const cat20 = await createCat20([1000n], ownerAddress, 'pubkey_mismatch');

            // Attack: Try to use attacker's pubkey but claim it hashes to owner's address
            return expect(
                spendWithMismatchedPubkey(cat20, attackerPubKey, ownerAddress)
            ).to.eventually.be.rejectedWith('owner address is not match to the pubkey');
        });

        it('should FAIL: forge owner address in unlock args', async () => {
            const cat20 = await createCat20([1000n], ownerAddress, 'forge_owner');

            // Attack: Try to use attacker credentials with forged owner address
            return expect(
                spendWithForgedOwnerAddress(cat20, attackerSigner, attackerPubKey)
            ).to.eventually.be.rejectedWith('owner address is not match to the pubkey');
        });
    });

    describe('Attack Vector 3: Guard Input Manipulation', () => {
        it('should FAIL: spend without guard input', async () => {
            const cat20 = await createCat20([1000n], ownerAddress, 'no_guard');

            return expect(
                spendWithoutGuard(cat20)
            ).to.eventually.be.rejected;
        });

        it('should FAIL: use fake guard contract', async () => {
            const cat20 = await createCat20([1000n], ownerAddress, 'fake_guard');

            return expect(
                spendWithFakeGuard(cat20)
            ).to.eventually.be.rejectedWith('guard script hash is invalid');
        });

        it('should FAIL: wrong guard input index', async () => {
            const cat20 = await createCat20([1000n], ownerAddress, 'wrong_guard_idx');

            return expect(
                spendWithWrongGuardIndex(cat20)
            ).to.eventually.be.rejected;
        });
    });

    describe('Attack Vector 4: Contract Spend Abuse', () => {
        it('should FAIL: spendType=1 (contract) without matching contract input', async () => {
            const cat20 = await createCat20([1000n], ownerAddress, 'fake_contract_spend');

            return expect(
                spendAsContractWithoutContract(cat20)
            ).to.eventually.be.rejected;
        });

        it('should FAIL: spendType=2 (admin) without admin privileges', async () => {
            const cat20 = await createCat20([1000n], ownerAddress, 'fake_admin_spend');

            return expect(
                spendAsAdminWithoutAdmin(cat20)
            ).to.eventually.be.rejected;
        });

        it('should FAIL: invalid spendType value', async () => {
            const cat20 = await createCat20([1000n], ownerAddress, 'invalid_spend_type');

            return expect(
                spendWithInvalidSpendType(cat20, 99n)
            ).to.eventually.be.rejectedWith('invalid spendType');
        });
    });

    describe('Attack Vector 5: Backtrace Forgery', () => {
        it('should FAIL: forge backtrace to skip minter verification', async () => {
            const cat20 = await createCat20([1000n], ownerAddress, 'forge_backtrace');

            return expect(
                spendWithForgedBacktrace(cat20)
            ).to.eventually.be.rejected;
        });
    });

    // ============ Helper Functions ============

    async function spendWithWrongSignature(cat20: TestCat20, wrongSigner: Signer, correctPubKey: PubKey) {
        const guardOwnerAddr = toTokenOwnerAddress(ownerAddress);
        const wrongSignerAddress = await wrongSigner.getAddress();
        const { guard, guardState, txInputCountMax, txOutputCountMax } = CAT20GuardPeripheral.createTransferGuard(
            cat20.utxos.map((utxo, index) => ({ token: utxo, inputIndex: index })),
            [{ address: CAT20.deserializeState(cat20.utxos[0].data).ownerAddr, amount: 1000n, outputIndex: 0 }],
            cat20.utxos.length + 2,
            2,
            guardOwnerAddr
        );
        guard.state = guardState;

        const guardInputIndex = cat20.utxos.length;
        const psbt = new ExtPsbt({ network: await testProvider.getNetwork(), maximumFeeRate: 1e8 });

        cat20.utxos.forEach((utxo, inputIndex) => {
            const cat20Contract = new CAT20(
                cat20.generator.minterScriptHash,
                cat20.generator.guardScriptHashes,
                cat20.generator.deployInfo.hasAdmin,
                cat20.generator.deployInfo.adminScriptHash
            ).bindToUtxo(utxo);

            psbt.addContractInput(cat20Contract, (contract, curPsbt) => {
                contract.unlock(
                    {
                        userPubKey: correctPubKey,
                        // Use wrong signer's signature
                        userSig: curPsbt.getSig(inputIndex, { address: wrongSignerAddress }),
                        spendScriptInputIndex: -1n,
                        spendType: 0n,
                    },
                    guardState,
                    BigInt(guardInputIndex),
                    getBackTraceInfo(
                        cat20.utxoTraces[inputIndex].prevTxHex,
                        cat20.utxoTraces[inputIndex].prevPrevTxHex,
                        cat20.utxoTraces[inputIndex].prevTxInput
                    )
                );
            });
        });

        await addGuardAndOutput(psbt, guard, cat20, guardState, txInputCountMax, txOutputCountMax, [1000n]);

        // Sign with wrong signer
        const signedPsbtHex = await wrongSigner.signPsbt(psbt.seal().toHex(), psbt.psbtOptions());
        psbt.combine(ExtPsbt.fromHex(signedPsbtHex)).finalizeAllInputs();
    }

    async function spendWithAttackerKeys(
        cat20: TestCat20,
        attacker: Signer,
        attackerPubKey: PubKey,
        attackerAddr: string
    ) {
        const guardOwnerAddr = toTokenOwnerAddress(ownerAddress);
        const { guard, guardState, txInputCountMax, txOutputCountMax } = CAT20GuardPeripheral.createTransferGuard(
            cat20.utxos.map((utxo, index) => ({ token: utxo, inputIndex: index })),
            [{ address: toTokenOwnerAddress(attackerAddr), amount: 1000n, outputIndex: 0 }],
            cat20.utxos.length + 2,
            2,
            guardOwnerAddr
        );
        guard.state = guardState;

        const guardInputIndex = cat20.utxos.length;
        const psbt = new ExtPsbt({ network: await testProvider.getNetwork(), maximumFeeRate: 1e8 });

        cat20.utxos.forEach((utxo, inputIndex) => {
            const cat20Contract = new CAT20(
                cat20.generator.minterScriptHash,
                cat20.generator.guardScriptHashes,
                cat20.generator.deployInfo.hasAdmin,
                cat20.generator.deployInfo.adminScriptHash
            ).bindToUtxo(utxo);

            psbt.addContractInput(cat20Contract, (contract, curPsbt) => {
                contract.unlock(
                    {
                        userPubKey: attackerPubKey, // Attacker's pubkey
                        userSig: curPsbt.getSig(inputIndex, { address: attackerAddr }),
                        spendScriptInputIndex: -1n,
                        spendType: 0n,
                    },
                    guardState,
                    BigInt(guardInputIndex),
                    getBackTraceInfo(
                        cat20.utxoTraces[inputIndex].prevTxHex,
                        cat20.utxoTraces[inputIndex].prevPrevTxHex,
                        cat20.utxoTraces[inputIndex].prevTxInput
                    )
                );
            });
        });

        await addGuardAndOutput(psbt, guard, cat20, guardState, txInputCountMax, txOutputCountMax, [1000n]);

        const signedPsbtHex = await attacker.signPsbt(psbt.seal().toHex(), psbt.psbtOptions());
        psbt.combine(ExtPsbt.fromHex(signedPsbtHex)).finalizeAllInputs();
    }

    async function getValidSignatureForDifferentTx(cat20: TestCat20): Promise<string> {
        // Create a different transaction and get its signature
        const dummyPsbt = new ExtPsbt({ network: await testProvider.getNetwork() })
            .spendUTXO(getDummyUtxo(ownerAddress, 1e8))
            .change(ownerAddress, 1)
            .seal();

        const signedHex = await testSigner.signPsbt(dummyPsbt.toHex(), dummyPsbt.psbtOptions());
        return signedHex;
    }

    async function spendWithReplayedSignature(cat20: TestCat20, replayedSigPsbtHex: string) {
        const guardOwnerAddr = toTokenOwnerAddress(ownerAddress);
        const { guard, guardState, txInputCountMax, txOutputCountMax } = CAT20GuardPeripheral.createTransferGuard(
            cat20.utxos.map((utxo, index) => ({ token: utxo, inputIndex: index })),
            [{ address: CAT20.deserializeState(cat20.utxos[0].data).ownerAddr, amount: 1000n, outputIndex: 0 }],
            cat20.utxos.length + 2,
            2,
            guardOwnerAddr
        );
        guard.state = guardState;

        const guardInputIndex = cat20.utxos.length;
        const psbt = new ExtPsbt({ network: await testProvider.getNetwork(), maximumFeeRate: 1e8 });

        cat20.utxos.forEach((utxo, inputIndex) => {
            const cat20Contract = new CAT20(
                cat20.generator.minterScriptHash,
                cat20.generator.guardScriptHashes,
                cat20.generator.deployInfo.hasAdmin,
                cat20.generator.deployInfo.adminScriptHash
            ).bindToUtxo(utxo);

            psbt.addContractInput(cat20Contract, (contract, curPsbt) => {
                // Extract sig from replayed psbt - this will fail because sighash won't match
                const replayedPsbt = ExtPsbt.fromHex(replayedSigPsbtHex);
                contract.unlock(
                    {
                        userPubKey: ownerPubKey,
                        userSig: curPsbt.getSig(inputIndex, { address: ownerAddress }), // Will be wrong context
                        spendScriptInputIndex: -1n,
                        spendType: 0n,
                    },
                    guardState,
                    BigInt(guardInputIndex),
                    getBackTraceInfo(
                        cat20.utxoTraces[inputIndex].prevTxHex,
                        cat20.utxoTraces[inputIndex].prevPrevTxHex,
                        cat20.utxoTraces[inputIndex].prevTxInput
                    )
                );
            });
        });

        await addGuardAndOutput(psbt, guard, cat20, guardState, txInputCountMax, txOutputCountMax, [1000n]);

        // Don't sign this PSBT - try to use the replayed signature
        psbt.combine(ExtPsbt.fromHex(replayedSigPsbtHex)).finalizeAllInputs();
    }

    async function spendWithMismatchedPubkey(cat20: TestCat20, wrongPubKey: PubKey, claimedAddress: string) {
        const guardOwnerAddr = toTokenOwnerAddress(ownerAddress);
        const { guard, guardState, txInputCountMax, txOutputCountMax } = CAT20GuardPeripheral.createTransferGuard(
            cat20.utxos.map((utxo, index) => ({ token: utxo, inputIndex: index })),
            [{ address: CAT20.deserializeState(cat20.utxos[0].data).ownerAddr, amount: 1000n, outputIndex: 0 }],
            cat20.utxos.length + 2,
            2,
            guardOwnerAddr
        );
        guard.state = guardState;

        const guardInputIndex = cat20.utxos.length;
        const psbt = new ExtPsbt({ network: await testProvider.getNetwork(), maximumFeeRate: 1e8 });

        cat20.utxos.forEach((utxo, inputIndex) => {
            const cat20Contract = new CAT20(
                cat20.generator.minterScriptHash,
                cat20.generator.guardScriptHashes,
                cat20.generator.deployInfo.hasAdmin,
                cat20.generator.deployInfo.adminScriptHash
            ).bindToUtxo(utxo);

            psbt.addContractInput(cat20Contract, (contract, curPsbt) => {
                contract.unlock(
                    {
                        userPubKey: wrongPubKey, // Wrong pubkey
                        userSig: curPsbt.getSig(inputIndex, { address: claimedAddress }),
                        spendScriptInputIndex: -1n,
                        spendType: 0n,
                    },
                    guardState,
                    BigInt(guardInputIndex),
                    getBackTraceInfo(
                        cat20.utxoTraces[inputIndex].prevTxHex,
                        cat20.utxoTraces[inputIndex].prevPrevTxHex,
                        cat20.utxoTraces[inputIndex].prevTxInput
                    )
                );
            });
        });

        await addGuardAndOutput(psbt, guard, cat20, guardState, txInputCountMax, txOutputCountMax, [1000n]);

        const signedPsbtHex = await testSigner.signPsbt(psbt.seal().toHex(), psbt.psbtOptions());
        psbt.combine(ExtPsbt.fromHex(signedPsbtHex)).finalizeAllInputs();
    }

    async function spendWithForgedOwnerAddress(cat20: TestCat20, attacker: Signer, attackerPubKey: PubKey) {
        const guardOwnerAddr = toTokenOwnerAddress(ownerAddress);
        const attackerAddr = await attacker.getAddress();
        const { guard, guardState, txInputCountMax, txOutputCountMax } = CAT20GuardPeripheral.createTransferGuard(
            cat20.utxos.map((utxo, index) => ({ token: utxo, inputIndex: index })),
            [{ address: CAT20.deserializeState(cat20.utxos[0].data).ownerAddr, amount: 1000n, outputIndex: 0 }],
            cat20.utxos.length + 2,
            2,
            guardOwnerAddr
        );
        guard.state = guardState;

        const guardInputIndex = cat20.utxos.length;
        const psbt = new ExtPsbt({ network: await testProvider.getNetwork(), maximumFeeRate: 1e8 });

        cat20.utxos.forEach((utxo, inputIndex) => {
            const cat20Contract = new CAT20(
                cat20.generator.minterScriptHash,
                cat20.generator.guardScriptHashes,
                cat20.generator.deployInfo.hasAdmin,
                cat20.generator.deployInfo.adminScriptHash
            ).bindToUtxo(utxo);

            psbt.addContractInput(cat20Contract, (contract, curPsbt) => {
                contract.unlock(
                    {
                        userPubKey: attackerPubKey,
                        userSig: curPsbt.getSig(inputIndex, { address: attackerAddr }),
                        spendScriptInputIndex: -1n,
                        spendType: 0n,
                    },
                    guardState,
                    BigInt(guardInputIndex),
                    getBackTraceInfo(
                        cat20.utxoTraces[inputIndex].prevTxHex,
                        cat20.utxoTraces[inputIndex].prevPrevTxHex,
                        cat20.utxoTraces[inputIndex].prevTxInput
                    )
                );
            });
        });

        await addGuardAndOutput(psbt, guard, cat20, guardState, txInputCountMax, txOutputCountMax, [1000n]);

        const signedPsbtHex = await attacker.signPsbt(psbt.seal().toHex(), psbt.psbtOptions());
        psbt.combine(ExtPsbt.fromHex(signedPsbtHex)).finalizeAllInputs();
    }

    async function spendWithoutGuard(cat20: TestCat20) {
        const psbt = new ExtPsbt({ network: await testProvider.getNetwork(), maximumFeeRate: 1e8 });

        // Try to spend token without including guard input
        cat20.utxos.forEach((utxo, inputIndex) => {
            const cat20Contract = new CAT20(
                cat20.generator.minterScriptHash,
                cat20.generator.guardScriptHashes,
                cat20.generator.deployInfo.hasAdmin,
                cat20.generator.deployInfo.adminScriptHash
            ).bindToUtxo(utxo);

            const emptyGuardState = CAT20GuardStateLib.createEmptyState(TX_INPUT_COUNT_MAX_6);

            psbt.addContractInput(cat20Contract, (contract, curPsbt) => {
                contract.unlock(
                    {
                        userPubKey: ownerPubKey,
                        userSig: curPsbt.getSig(inputIndex, { address: ownerAddress }),
                        spendScriptInputIndex: -1n,
                        spendType: 0n,
                    },
                    emptyGuardState,
                    0n, // Non-existent guard index
                    getBackTraceInfo(
                        cat20.utxoTraces[inputIndex].prevTxHex,
                        cat20.utxoTraces[inputIndex].prevPrevTxHex,
                        cat20.utxoTraces[inputIndex].prevTxInput
                    )
                );
            });
        });

        psbt.change(ownerAddress, 0);

        const signedPsbtHex = await testSigner.signPsbt(psbt.seal().toHex(), psbt.psbtOptions());
        psbt.combine(ExtPsbt.fromHex(signedPsbtHex)).finalizeAllInputs();
    }

    async function spendWithFakeGuard(cat20: TestCat20) {
        // Create a fake guard with wrong script hash
        const fakeGuardState = CAT20GuardStateLib.createEmptyState(TX_INPUT_COUNT_MAX_6);
        fakeGuardState.deployerAddr = toTokenOwnerAddress(ownerAddress);
        fakeGuardState.tokenScriptHashes[0] = ContractPeripheral.scriptHash(cat20.utxos[0].script);
        fakeGuardState.tokenAmounts[0] = 1000n;

        let tokenScriptIndexes = fakeGuardState.tokenScriptIndexes;
        for (let index = 0; index < cat20.utxos.length; index++) {
            const before = slice(tokenScriptIndexes, 0n, BigInt(index));
            const after = slice(tokenScriptIndexes, BigInt(index + 1));
            tokenScriptIndexes = before + intToByteString(0n, 1n) + after;
        }
        fakeGuardState.tokenScriptIndexes = tokenScriptIndexes;

        const psbt = new ExtPsbt({ network: await testProvider.getNetwork(), maximumFeeRate: 1e8 });

        cat20.utxos.forEach((utxo, inputIndex) => {
            const cat20Contract = new CAT20(
                cat20.generator.minterScriptHash,
                cat20.generator.guardScriptHashes,
                cat20.generator.deployInfo.hasAdmin,
                cat20.generator.deployInfo.adminScriptHash
            ).bindToUtxo(utxo);

            psbt.addContractInput(cat20Contract, (contract, curPsbt) => {
                contract.unlock(
                    {
                        userPubKey: ownerPubKey,
                        userSig: curPsbt.getSig(inputIndex, { address: ownerAddress }),
                        spendScriptInputIndex: -1n,
                        spendType: 0n,
                    },
                    fakeGuardState,
                    BigInt(cat20.utxos.length), // Fake guard at this index
                    getBackTraceInfo(
                        cat20.utxoTraces[inputIndex].prevTxHex,
                        cat20.utxoTraces[inputIndex].prevPrevTxHex,
                        cat20.utxoTraces[inputIndex].prevTxInput
                    )
                );
            });
        });

        // Add a P2PKH input pretending to be guard
        psbt.spendUTXO(getDummyUtxo(ownerAddress, 1e8));
        psbt.change(ownerAddress, 0);

        const signedPsbtHex = await testSigner.signPsbt(psbt.seal().toHex(), psbt.psbtOptions());
        psbt.combine(ExtPsbt.fromHex(signedPsbtHex)).finalizeAllInputs();
    }

    async function spendWithWrongGuardIndex(cat20: TestCat20) {
        const guardOwnerAddr = toTokenOwnerAddress(ownerAddress);
        const { guard, guardState, txInputCountMax, txOutputCountMax } = CAT20GuardPeripheral.createTransferGuard(
            cat20.utxos.map((utxo, index) => ({ token: utxo, inputIndex: index })),
            [{ address: CAT20.deserializeState(cat20.utxos[0].data).ownerAddr, amount: 1000n, outputIndex: 0 }],
            cat20.utxos.length + 2,
            2,
            guardOwnerAddr
        );
        guard.state = guardState;

        const psbt = new ExtPsbt({ network: await testProvider.getNetwork(), maximumFeeRate: 1e8 });
        const wrongGuardIndex = 999n; // Wrong index

        cat20.utxos.forEach((utxo, inputIndex) => {
            const cat20Contract = new CAT20(
                cat20.generator.minterScriptHash,
                cat20.generator.guardScriptHashes,
                cat20.generator.deployInfo.hasAdmin,
                cat20.generator.deployInfo.adminScriptHash
            ).bindToUtxo(utxo);

            psbt.addContractInput(cat20Contract, (contract, curPsbt) => {
                contract.unlock(
                    {
                        userPubKey: ownerPubKey,
                        userSig: curPsbt.getSig(inputIndex, { address: ownerAddress }),
                        spendScriptInputIndex: -1n,
                        spendType: 0n,
                    },
                    guardState,
                    wrongGuardIndex, // Wrong!
                    getBackTraceInfo(
                        cat20.utxoTraces[inputIndex].prevTxHex,
                        cat20.utxoTraces[inputIndex].prevPrevTxHex,
                        cat20.utxoTraces[inputIndex].prevTxInput
                    )
                );
            });
        });

        await addGuardAndOutput(psbt, guard, cat20, guardState, txInputCountMax, txOutputCountMax, [1000n]);

        const signedPsbtHex = await testSigner.signPsbt(psbt.seal().toHex(), psbt.psbtOptions());
        psbt.combine(ExtPsbt.fromHex(signedPsbtHex)).finalizeAllInputs();
    }

    async function spendAsContractWithoutContract(cat20: TestCat20) {
        const guardOwnerAddr = toTokenOwnerAddress(ownerAddress);
        const { guard, guardState, txInputCountMax, txOutputCountMax } = CAT20GuardPeripheral.createTransferGuard(
            cat20.utxos.map((utxo, index) => ({ token: utxo, inputIndex: index })),
            [{ address: CAT20.deserializeState(cat20.utxos[0].data).ownerAddr, amount: 1000n, outputIndex: 0 }],
            cat20.utxos.length + 2,
            2,
            guardOwnerAddr
        );
        guard.state = guardState;

        const guardInputIndex = cat20.utxos.length;
        const psbt = new ExtPsbt({ network: await testProvider.getNetwork(), maximumFeeRate: 1e8 });

        cat20.utxos.forEach((utxo, inputIndex) => {
            const cat20Contract = new CAT20(
                cat20.generator.minterScriptHash,
                cat20.generator.guardScriptHashes,
                cat20.generator.deployInfo.hasAdmin,
                cat20.generator.deployInfo.adminScriptHash
            ).bindToUtxo(utxo);

            psbt.addContractInput(cat20Contract, (contract, curPsbt) => {
                contract.unlock(
                    {
                        userPubKey: ownerPubKey,
                        userSig: curPsbt.getSig(inputIndex, { address: ownerAddress }),
                        spendScriptInputIndex: 0n, // Claim contract at index 0
                        spendType: 1n, // Contract spend type
                    },
                    guardState,
                    BigInt(guardInputIndex),
                    getBackTraceInfo(
                        cat20.utxoTraces[inputIndex].prevTxHex,
                        cat20.utxoTraces[inputIndex].prevPrevTxHex,
                        cat20.utxoTraces[inputIndex].prevTxInput
                    )
                );
            });
        });

        await addGuardAndOutput(psbt, guard, cat20, guardState, txInputCountMax, txOutputCountMax, [1000n]);

        const signedPsbtHex = await testSigner.signPsbt(psbt.seal().toHex(), psbt.psbtOptions());
        psbt.combine(ExtPsbt.fromHex(signedPsbtHex)).finalizeAllInputs();
    }

    async function spendAsAdminWithoutAdmin(cat20: TestCat20) {
        const guardOwnerAddr = toTokenOwnerAddress(ownerAddress);
        const { guard, guardState, txInputCountMax, txOutputCountMax } = CAT20GuardPeripheral.createTransferGuard(
            cat20.utxos.map((utxo, index) => ({ token: utxo, inputIndex: index })),
            [{ address: CAT20.deserializeState(cat20.utxos[0].data).ownerAddr, amount: 1000n, outputIndex: 0 }],
            cat20.utxos.length + 2,
            2,
            guardOwnerAddr
        );
        guard.state = guardState;

        const guardInputIndex = cat20.utxos.length;
        const psbt = new ExtPsbt({ network: await testProvider.getNetwork(), maximumFeeRate: 1e8 });

        cat20.utxos.forEach((utxo, inputIndex) => {
            const cat20Contract = new CAT20(
                cat20.generator.minterScriptHash,
                cat20.generator.guardScriptHashes,
                cat20.generator.deployInfo.hasAdmin,
                cat20.generator.deployInfo.adminScriptHash
            ).bindToUtxo(utxo);

            psbt.addContractInput(cat20Contract, (contract, curPsbt) => {
                contract.unlock(
                    {
                        userPubKey: ownerPubKey,
                        userSig: curPsbt.getSig(inputIndex, { address: ownerAddress }),
                        spendScriptInputIndex: 0n,
                        spendType: 2n, // Admin spend type
                    },
                    guardState,
                    BigInt(guardInputIndex),
                    getBackTraceInfo(
                        cat20.utxoTraces[inputIndex].prevTxHex,
                        cat20.utxoTraces[inputIndex].prevPrevTxHex,
                        cat20.utxoTraces[inputIndex].prevTxInput
                    )
                );
            });
        });

        await addGuardAndOutput(psbt, guard, cat20, guardState, txInputCountMax, txOutputCountMax, [1000n]);

        const signedPsbtHex = await testSigner.signPsbt(psbt.seal().toHex(), psbt.psbtOptions());
        psbt.combine(ExtPsbt.fromHex(signedPsbtHex)).finalizeAllInputs();
    }

    async function spendWithInvalidSpendType(cat20: TestCat20, invalidSpendType: bigint) {
        const guardOwnerAddr = toTokenOwnerAddress(ownerAddress);
        const { guard, guardState, txInputCountMax, txOutputCountMax } = CAT20GuardPeripheral.createTransferGuard(
            cat20.utxos.map((utxo, index) => ({ token: utxo, inputIndex: index })),
            [{ address: CAT20.deserializeState(cat20.utxos[0].data).ownerAddr, amount: 1000n, outputIndex: 0 }],
            cat20.utxos.length + 2,
            2,
            guardOwnerAddr
        );
        guard.state = guardState;

        const guardInputIndex = cat20.utxos.length;
        const psbt = new ExtPsbt({ network: await testProvider.getNetwork(), maximumFeeRate: 1e8 });

        cat20.utxos.forEach((utxo, inputIndex) => {
            const cat20Contract = new CAT20(
                cat20.generator.minterScriptHash,
                cat20.generator.guardScriptHashes,
                cat20.generator.deployInfo.hasAdmin,
                cat20.generator.deployInfo.adminScriptHash
            ).bindToUtxo(utxo);

            psbt.addContractInput(cat20Contract, (contract, curPsbt) => {
                contract.unlock(
                    {
                        userPubKey: ownerPubKey,
                        userSig: curPsbt.getSig(inputIndex, { address: ownerAddress }),
                        spendScriptInputIndex: -1n,
                        spendType: invalidSpendType, // Invalid!
                    },
                    guardState,
                    BigInt(guardInputIndex),
                    getBackTraceInfo(
                        cat20.utxoTraces[inputIndex].prevTxHex,
                        cat20.utxoTraces[inputIndex].prevPrevTxHex,
                        cat20.utxoTraces[inputIndex].prevTxInput
                    )
                );
            });
        });

        await addGuardAndOutput(psbt, guard, cat20, guardState, txInputCountMax, txOutputCountMax, [1000n]);

        const signedPsbtHex = await testSigner.signPsbt(psbt.seal().toHex(), psbt.psbtOptions());
        psbt.combine(ExtPsbt.fromHex(signedPsbtHex)).finalizeAllInputs();
    }

    async function spendWithForgedBacktrace(cat20: TestCat20) {
        const guardOwnerAddr = toTokenOwnerAddress(ownerAddress);
        const { guard, guardState, txInputCountMax, txOutputCountMax } = CAT20GuardPeripheral.createTransferGuard(
            cat20.utxos.map((utxo, index) => ({ token: utxo, inputIndex: index })),
            [{ address: CAT20.deserializeState(cat20.utxos[0].data).ownerAddr, amount: 1000n, outputIndex: 0 }],
            cat20.utxos.length + 2,
            2,
            guardOwnerAddr
        );
        guard.state = guardState;

        const guardInputIndex = cat20.utxos.length;
        const psbt = new ExtPsbt({ network: await testProvider.getNetwork(), maximumFeeRate: 1e8 });

        // Create forged backtrace with wrong transaction hashes
        const forgedBacktrace = {
            prevTxHex: '0100000001000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001000000000000000000',
            prevTxInput: 0,
            prevPrevTxHex: '0100000001000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001000000000000000000'
        };

        cat20.utxos.forEach((utxo, inputIndex) => {
            const cat20Contract = new CAT20(
                cat20.generator.minterScriptHash,
                cat20.generator.guardScriptHashes,
                cat20.generator.deployInfo.hasAdmin,
                cat20.generator.deployInfo.adminScriptHash
            ).bindToUtxo(utxo);

            psbt.addContractInput(cat20Contract, (contract, curPsbt) => {
                contract.unlock(
                    {
                        userPubKey: ownerPubKey,
                        userSig: curPsbt.getSig(inputIndex, { address: ownerAddress }),
                        spendScriptInputIndex: -1n,
                        spendType: 0n,
                    },
                    guardState,
                    BigInt(guardInputIndex),
                    getBackTraceInfo(
                        forgedBacktrace.prevTxHex,
                        forgedBacktrace.prevPrevTxHex,
                        forgedBacktrace.prevTxInput
                    )
                );
            });
        });

        await addGuardAndOutput(psbt, guard, cat20, guardState, txInputCountMax, txOutputCountMax, [1000n]);

        const signedPsbtHex = await testSigner.signPsbt(psbt.seal().toHex(), psbt.psbtOptions());
        psbt.combine(ExtPsbt.fromHex(signedPsbtHex)).finalizeAllInputs();
    }

    // Helper to deploy guard and add it with outputs
    async function deployGuardAndAddToTx(
        sendPsbt: ExtPsbt,
        guard: any,
        cat20: TestCat20,
        guardState: any,
        txInputCountMax: number,
        txOutputCountMax: number,
        outputAmounts: bigint[]
    ) {
        const outputStates: CAT20State[] = outputAmounts.map((amount) => ({
            ownerAddr: CAT20.deserializeState(cat20.utxos[0].data).ownerAddr,
            amount,
        }));

        // Step 1: Deploy the guard in a separate transaction
        const feeUtxos = await testProvider.getUtxos(ownerAddress);
        const guardPsbt = new ExtPsbt({ network: await testProvider.getNetwork(), maximumFeeRate: 1e8 })
            .spendUTXO(feeUtxos.slice(0, 3))
            .addContractOutput(guard, Postage.GUARD_POSTAGE)
            .change(ownerAddress, await testProvider.getFeeRate())
            .seal();

        const signedGuardPsbt = ExtPsbt.fromHex(await testSigner.signPsbt(guardPsbt.toHex(), guardPsbt.psbtOptions()));
        guardPsbt.combine(signedGuardPsbt).finalizeAllInputs();

        // Get the guard UTXO from the guard transaction
        const guardUtxo = guardPsbt.getUtxo(0);
        guard.bindToUtxo(guardUtxo);

        // Step 2: Add guard input to the send transaction
        sendPsbt.addContractInput(guard, (contract, curPsbt) => {
            const ownerAddrOrScripts = fill(toByteString(''), txOutputCountMax);
            applyFixedArray(
                ownerAddrOrScripts,
                curPsbt.txOutputs.map((output, index) => {
                    return index < outputStates.length
                        ? outputStates[index].ownerAddr
                        : ContractPeripheral.scriptHash(toHex(output.script));
                })
            );

            const outputTokens = fill(0n, txOutputCountMax);
            applyFixedArray(outputTokens, outputAmounts, 0);

            const tokenScriptIndexes = fill(-1n, txOutputCountMax);
            applyFixedArray(tokenScriptIndexes, outputAmounts.map(() => 0n), 0);

            const outputSatoshis = fill(0n, txOutputCountMax);
            applyFixedArray(outputSatoshis, curPsbt.txOutputs.map((o) => BigInt(o.value)));

            const cat20States = fill(CAT20StateLib.create(0n, toByteString('')), txInputCountMax);
            applyFixedArray(cat20States, cat20.utxos.map((u) => CAT20.deserializeState(u.data)), 0);

            const nextStateHashes = fill(toByteString(''), txOutputCountMax);
            applyFixedArray(nextStateHashes, curPsbt.txOutputs.map((o) => sha256(toHex(o.data))));

            contract.unlock(
                nextStateHashes,
                ownerAddrOrScripts,
                outputTokens,
                tokenScriptIndexes,
                outputSatoshis,
                cat20States,
                BigInt(curPsbt.txOutputs.length)
            );
        });

        outputStates.forEach((state) => {
            const outputCat20 = new CAT20(
                cat20.generator.minterScriptHash,
                cat20.generator.guardScriptHashes,
                cat20.generator.deployInfo.hasAdmin,
                cat20.generator.deployInfo.adminScriptHash
            );
            outputCat20.state = state;
            sendPsbt.addContractOutput(outputCat20, Postage.TOKEN_POSTAGE);
        });

        // Add fee input from the guard transaction change
        const feeUtxo = guardPsbt.getChangeUTXO();
        if (feeUtxo) {
            sendPsbt.spendUTXO(feeUtxo);
        }

        sendPsbt.change(ownerAddress, 0);
    }

    // Backward compatible wrapper (now async)
    async function addGuardAndOutput(
        psbt: ExtPsbt,
        guard: any,
        cat20: TestCat20,
        guardState: any,
        txInputCountMax: number,
        txOutputCountMax: number,
        outputAmounts: bigint[]
    ) {
        return deployGuardAndAddToTx(psbt, guard, cat20, guardState, txInputCountMax, txOutputCountMax, outputAmounts);
    }
});
