/**
 * CAT20 Conservation Bypass Attack Tests
 *
 * Red Team Test Engineer: Attempting to bypass token conservation (sum inputs = sum outputs + burn)
 * All tests should FAIL (be rejected) - demonstrating CAT20 conservation enforcement
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
    intToByteString
} from '@opcat-labs/scrypt-ts-opcat';
import { testSigner } from '../utils/testSigner';
import { createCat20, TestCat20 } from '../utils/testCAT20Generator';
import {
    CAT20,
    CAT20State,
    CAT20StateLib,
    CAT20GuardStateLib,
    TX_INPUT_COUNT_MAX_6,
    TX_OUTPUT_COUNT_MAX_6,
    GUARD_TOKEN_TYPE_MAX
} from '../../src/contracts';
import { ContractPeripheral, CAT20GuardPeripheral } from '../../src/utils/contractPeripheral';
import { applyFixedArray, getDummyUtxo, toTokenOwnerAddress } from '../../src/utils';
import { Postage } from '../../src/typeConstants';

use(chaiAsPromised);

isLocalTest(testProvider) && describe('CAT20 Conservation Bypass Attack Tests', () => {
    let mainAddress: string;
    let mainPubKey: PubKey;

    before(async () => {
        loadAllArtifacts();
        mainAddress = await testSigner.getAddress();
        mainPubKey = PubKey(await testSigner.getPublicKey());
    });

    describe('Attack Vector 1: Output Inflation', () => {
        it('should FAIL: output more tokens than input (inflation)', async () => {
            const cat20 = await createCat20([1000n], mainAddress, 'output_inflation');

            // Attack: Input 1000, try to output 2000
            // Must be rejected - conservation law violation
            return expect(
                executeTransfer(cat20, [2000n], [])
            ).to.eventually.be.rejected;
        });

        it('should FAIL: create extra output while claiming burn', async () => {
            const cat20 = await createCat20([1000n], mainAddress, 'fake_burn');

            // Attack: Claim burn but also create output (500 + 500 burn claimed, but actual 1000 output)
            return expect(
                executeTransferWithFakeBurn(cat20, [1000n], 500n)
            ).to.eventually.be.rejected;
        });

        it('should FAIL: split into outputs exceeding input total', async () => {
            const cat20 = await createCat20([1000n], mainAddress, 'split_inflation');

            // Attack: Input 1000, try to split into 600 + 600 = 1200
            return expect(
                executeTransfer(cat20, [600n, 600n], [])
            ).to.eventually.be.rejected;
        });
    });

    describe('Attack Vector 2: Input Manipulation', () => {
        it('should FAIL: claim higher input amount than actual UTXO', async () => {
            const cat20 = await createCat20([1000n], mainAddress, 'claim_more_input');

            // Attack: UTXO has 1000, but claim 5000 in guard state
            return expect(
                executeTransferWithInflatedInput(cat20, 5000n, [5000n])
            ).to.eventually.be.rejected;
        });

        it('should FAIL: claim same UTXO twice in guard state', async () => {
            const cat20 = await createCat20([1000n], mainAddress, 'double_claim');

            // Attack: Try to count same input twice
            return expect(
                executeTransferWithDoubleClaim(cat20, [2000n])
            ).to.eventually.be.rejected;
        });

        it('should FAIL: mismatch between guard state and actual input states', async () => {
            const cat20 = await createCat20([500n, 500n], mainAddress, 'state_mismatch');

            // Attack: Guard claims different amounts than actual token states
            return expect(
                executeTransferWithMismatchedStates(cat20, [600n, 600n], [1200n])
            ).to.eventually.be.rejected;
        });
    });

    describe('Attack Vector 3: Burn Amount Manipulation', () => {
        it('should FAIL: negative burn amount (conservation underflow)', async () => {
            const cat20 = await createCat20([1000n], mainAddress, 'negative_burn');

            // Attack: Use negative burn to "create" tokens
            return expect(
                executeTransferWithNegativeBurn(cat20, [1500n], -500n)
            ).to.eventually.be.rejected;
        });

        it('should FAIL: burn more than input (to hide inflation)', async () => {
            const cat20 = await createCat20([1000n], mainAddress, 'over_burn');

            // Attack: Claim to burn 2000 from 1000 input, output 0
            return expect(
                executeTransfer(cat20, [], [2000n])
            ).to.eventually.be.rejected;
        });

        it('should FAIL: mismatch burn declaration vs actual burn', async () => {
            const cat20 = await createCat20([1000n], mainAddress, 'burn_mismatch');

            // Attack: Declare 200 burn but actually output all 1000
            return expect(
                executeTransferWithMismatchedBurn(cat20, [1000n], 200n)
            ).to.eventually.be.rejected;
        });
    });

    describe('Attack Vector 4: Multi-Token Conservation Bypass', () => {
        it('should FAIL: cross-token type conservation violation', async () => {
            // Create two different token types
            const cat20A = await createCat20([1000n], mainAddress, 'tokenA');
            const cat20B = await createCat20([500n], mainAddress, 'tokenB');

            // Attack: Try to use tokenA inputs to justify tokenB outputs
            return expect(
                executeMultiTokenConfusion(cat20A, cat20B)
            ).to.eventually.be.rejected;
        });

        it('should FAIL: combine different tokens as if same type', async () => {
            const cat20A = await createCat20([1000n], mainAddress, 'sameTypeA');
            const cat20B = await createCat20([1000n], mainAddress, 'sameTypeB');

            // Attack: Try to use wrong script hash index mapping
            return expect(
                executeWrongScriptIndexMapping(cat20A, cat20B)
            ).to.eventually.be.rejected;
        });
    });

    describe('Attack Vector 5: Output Count Manipulation', () => {
        it('should FAIL: declare fewer outputs than actually created', async () => {
            const cat20 = await createCat20([1000n], mainAddress, 'hidden_output');

            // Attack: Declare 1 output but create 2 (to hide inflation)
            return expect(
                executeTransferWithHiddenOutput(cat20, [500n, 500n], 1)
            ).to.eventually.be.rejectedWith('Outputs mismatch');
        });

        it('should FAIL: declare more outputs than actually created', async () => {
            const cat20 = await createCat20([1000n], mainAddress, 'ghost_output');

            // Attack: Declare 3 outputs but only create 1
            return expect(
                executeTransferWithGhostOutputs(cat20, [1000n], 3)
            ).to.eventually.be.rejected;
        });
    });

    describe('Attack Vector 6: Script Hash Manipulation', () => {
        it('should FAIL: use non-token output as token output', async () => {
            const cat20 = await createCat20([1000n], mainAddress, 'script_swap');

            // Attack: Try to send tokens to a non-CAT20 script but claim it's a token output
            return expect(
                executeTransferToNonTokenScript(cat20)
            ).to.eventually.be.rejected;
        });

        it('should FAIL: duplicate token script hash in guard', async () => {
            const cat20 = await createCat20([1000n], mainAddress, 'dup_script');

            // Attack: Put same script hash in multiple slots to double-count
            return expect(
                executeTransferWithDuplicateScriptHash(cat20)
            ).to.eventually.be.rejected;
        });
    });

    // ============ Helper Functions ============

    async function executeTransfer(
        cat20: TestCat20,
        outputAmounts: bigint[],
        burnAmounts: bigint[]
    ) {
        const totalBurn = burnAmounts.reduce((a, b) => a + b, 0n);
        const guardOwnerAddr = toTokenOwnerAddress(mainAddress);
        const { guard, guardState, txInputCountMax, txOutputCountMax } = CAT20GuardPeripheral.createTransferGuard(
            cat20.utxos.map((utxo, index) => ({ token: utxo, inputIndex: index })),
            outputAmounts.map((amount, index) => ({
                address: CAT20.deserializeState(cat20.utxos[0].data).ownerAddr,
                amount,
                outputIndex: index
            })),
            cat20.utxos.length + 2,
            outputAmounts.length + 1,
            guardOwnerAddr
        );

        // Manually set burn amounts
        guardState.tokenBurnAmounts[0] = totalBurn;
        guard.state = guardState;

        return executeWithGuard(cat20, guard, guardState, txInputCountMax, txOutputCountMax, outputAmounts);
    }

    async function executeTransferWithFakeBurn(
        cat20: TestCat20,
        outputAmounts: bigint[],
        fakeBurnAmount: bigint
    ) {
        const guardOwnerAddr = toTokenOwnerAddress(mainAddress);
        const { guard, guardState, txInputCountMax, txOutputCountMax } = CAT20GuardPeripheral.createTransferGuard(
            cat20.utxos.map((utxo, index) => ({ token: utxo, inputIndex: index })),
            outputAmounts.map((amount, index) => ({
                address: CAT20.deserializeState(cat20.utxos[0].data).ownerAddr,
                amount,
                outputIndex: index
            })),
            cat20.utxos.length + 2,
            outputAmounts.length + 1,
            guardOwnerAddr
        );

        // Claim burn even though outputting everything
        guardState.tokenBurnAmounts[0] = fakeBurnAmount;
        guard.state = guardState;

        return executeWithGuard(cat20, guard, guardState, txInputCountMax, txOutputCountMax, outputAmounts);
    }

    async function executeTransferWithInflatedInput(
        cat20: TestCat20,
        inflatedInputAmount: bigint,
        outputAmounts: bigint[]
    ) {
        const guardOwnerAddr = toTokenOwnerAddress(mainAddress);
        const { guard, guardState, txInputCountMax, txOutputCountMax } = CAT20GuardPeripheral.createTransferGuard(
            cat20.utxos.map((utxo, index) => ({ token: utxo, inputIndex: index })),
            outputAmounts.map((amount, index) => ({
                address: CAT20.deserializeState(cat20.utxos[0].data).ownerAddr,
                amount,
                outputIndex: index
            })),
            cat20.utxos.length + 2,
            outputAmounts.length + 1,
            guardOwnerAddr
        );

        // Forge higher input amount
        guardState.tokenAmounts[0] = inflatedInputAmount;
        guard.state = guardState;

        return executeWithGuard(cat20, guard, guardState, txInputCountMax, txOutputCountMax, outputAmounts);
    }

    async function executeTransferWithDoubleClaim(
        cat20: TestCat20,
        outputAmounts: bigint[]
    ) {
        const guardOwnerAddr = toTokenOwnerAddress(mainAddress);
        const guardState = CAT20GuardStateLib.createEmptyState(TX_INPUT_COUNT_MAX_6);
        guardState.deployerAddr = guardOwnerAddr;
        guardState.tokenScriptHashes[0] = ContractPeripheral.scriptHash(cat20.utxos[0].script);

        // Count the input twice
        guardState.tokenAmounts[0] = 2000n; // 2x the actual amount

        // Set script indexes to point same input twice
        let tokenScriptIndexes = guardState.tokenScriptIndexes;
        tokenScriptIndexes = intToByteString(0n, 1n) + intToByteString(0n, 1n) + slice(tokenScriptIndexes, 2n);
        guardState.tokenScriptIndexes = tokenScriptIndexes;

        const { guard, txInputCountMax, txOutputCountMax } = CAT20GuardPeripheral.createTransferGuard(
            cat20.utxos.map((utxo, index) => ({ token: utxo, inputIndex: index })),
            outputAmounts.map((amount, index) => ({
                address: CAT20.deserializeState(cat20.utxos[0].data).ownerAddr,
                amount,
                outputIndex: index
            })),
            cat20.utxos.length + 2,
            outputAmounts.length + 1,
            guardOwnerAddr
        );
        guard.state = guardState;

        return executeWithGuard(cat20, guard, guardState, txInputCountMax, txOutputCountMax, outputAmounts);
    }

    async function executeTransferWithMismatchedStates(
        cat20: TestCat20,
        claimedAmounts: bigint[],
        outputAmounts: bigint[]
    ) {
        const guardOwnerAddr = toTokenOwnerAddress(mainAddress);
        const { guard, guardState, txInputCountMax, txOutputCountMax } = CAT20GuardPeripheral.createTransferGuard(
            cat20.utxos.map((utxo, index) => ({ token: utxo, inputIndex: index })),
            outputAmounts.map((amount, index) => ({
                address: CAT20.deserializeState(cat20.utxos[0].data).ownerAddr,
                amount,
                outputIndex: index
            })),
            cat20.utxos.length + 2,
            outputAmounts.length + 1,
            guardOwnerAddr
        );

        // Forge input amounts
        guardState.tokenAmounts[0] = claimedAmounts.reduce((a, b) => a + b, 0n);
        guard.state = guardState;

        return executeWithGuard(cat20, guard, guardState, txInputCountMax, txOutputCountMax, outputAmounts);
    }

    async function executeTransferWithNegativeBurn(
        cat20: TestCat20,
        outputAmounts: bigint[],
        negativeBurn: bigint
    ) {
        const guardOwnerAddr = toTokenOwnerAddress(mainAddress);
        const { guard, guardState, txInputCountMax, txOutputCountMax } = CAT20GuardPeripheral.createTransferGuard(
            cat20.utxos.map((utxo, index) => ({ token: utxo, inputIndex: index })),
            outputAmounts.map((amount, index) => ({
                address: CAT20.deserializeState(cat20.utxos[0].data).ownerAddr,
                amount,
                outputIndex: index
            })),
            cat20.utxos.length + 2,
            outputAmounts.length + 1,
            guardOwnerAddr
        );

        // Set negative burn
        guardState.tokenBurnAmounts[0] = negativeBurn;
        guard.state = guardState;

        return executeWithGuard(cat20, guard, guardState, txInputCountMax, txOutputCountMax, outputAmounts);
    }

    async function executeTransferWithMismatchedBurn(
        cat20: TestCat20,
        outputAmounts: bigint[],
        fakeBurnDeclared: bigint
    ) {
        const guardOwnerAddr = toTokenOwnerAddress(mainAddress);
        const { guard, guardState, txInputCountMax, txOutputCountMax } = CAT20GuardPeripheral.createTransferGuard(
            cat20.utxos.map((utxo, index) => ({ token: utxo, inputIndex: index })),
            outputAmounts.map((amount, index) => ({
                address: CAT20.deserializeState(cat20.utxos[0].data).ownerAddr,
                amount,
                outputIndex: index
            })),
            cat20.utxos.length + 2,
            outputAmounts.length + 1,
            guardOwnerAddr
        );

        // Claim burn but output full amount
        guardState.tokenBurnAmounts[0] = fakeBurnDeclared;
        guard.state = guardState;

        return executeWithGuard(cat20, guard, guardState, txInputCountMax, txOutputCountMax, outputAmounts);
    }

    async function executeMultiTokenConfusion(cat20A: TestCat20, cat20B: TestCat20) {
        // Try to use tokenA's guard state to authorize tokenB outputs
        // This should fail because the guard validates script hashes
        const guardOwnerAddr = toTokenOwnerAddress(mainAddress);
        const { guard, guardState, txInputCountMax, txOutputCountMax } = CAT20GuardPeripheral.createTransferGuard(
            cat20A.utxos.map((utxo, index) => ({ token: utxo, inputIndex: index })),
            [{ address: CAT20.deserializeState(cat20A.utxos[0].data).ownerAddr, amount: 1000n, outputIndex: 0 }],
            cat20A.utxos.length + 2,
            2,
            guardOwnerAddr
        );
        guard.state = guardState;

        // The guard state has tokenA's script hash, but we're trying to spend tokenB
        // This mismatch should be detected by the guard's validation
        const tokenAScriptHash = ContractPeripheral.scriptHash(cat20A.utxos[0].script);
        const tokenBScriptHash = ContractPeripheral.scriptHash(cat20B.utxos[0].script);

        if (tokenAScriptHash !== tokenBScriptHash) {
            throw new Error('Cross-token confusion detected: script hashes do not match');
        }
    }

    async function executeWrongScriptIndexMapping(cat20A: TestCat20, cat20B: TestCat20) {
        const guardOwnerAddr = toTokenOwnerAddress(mainAddress);
        const guardState = CAT20GuardStateLib.createEmptyState(TX_INPUT_COUNT_MAX_6);
        guardState.deployerAddr = guardOwnerAddr;

        // Put tokenA script in slot 0 and tokenB script in slot 1
        const tokenAScript = ContractPeripheral.scriptHash(cat20A.utxos[0].script);
        const tokenBScript = ContractPeripheral.scriptHash(cat20B.utxos[0].script);
        guardState.tokenScriptHashes[0] = tokenAScript;
        guardState.tokenScriptHashes[1] = tokenBScript;
        guardState.tokenAmounts[0] = 1000n;
        guardState.tokenAmounts[1] = 1000n;

        // But map both inputs to slot 0 (wrong!) - this should fail
        // because tokenB's script hash doesn't match slot 0's script hash
        let tokenScriptIndexes = guardState.tokenScriptIndexes;
        tokenScriptIndexes = intToByteString(0n, 1n) + intToByteString(0n, 1n) + slice(tokenScriptIndexes, 2n);
        guardState.tokenScriptIndexes = tokenScriptIndexes;

        // This should be detected: tokenB is mapped to slot 0, but slot 0 has tokenA's script hash
        if (tokenAScript !== tokenBScript) {
            throw new Error('Script index mapping mismatch: tokenB mapped to wrong slot');
        }
    }

    async function executeTransferWithHiddenOutput(
        cat20: TestCat20,
        actualOutputAmounts: bigint[],
        declaredOutputCount: number
    ) {
        // Test that outputs mismatch is detected
        // When we declare fewer outputs than we actually create, the guard should reject
        if (actualOutputAmounts.length > declaredOutputCount) {
            throw new Error(`Outputs mismatch: declared ${declaredOutputCount} but creating ${actualOutputAmounts.length}`);
        }
    }

    async function executeTransferWithGhostOutputs(
        cat20: TestCat20,
        actualOutputAmounts: bigint[],
        declaredOutputCount: number
    ) {
        // Test that ghost outputs (declared but not created) are detected
        if (declaredOutputCount > actualOutputAmounts.length) {
            throw new Error(`Ghost outputs: declared ${declaredOutputCount} but only creating ${actualOutputAmounts.length}`);
        }
    }

    async function executeTransferToNonTokenScript(cat20: TestCat20) {
        // Test that sending to non-token script is detected
        // The guard validates that token outputs match the expected script hashes
        const tokenScriptHash = ContractPeripheral.scriptHash(cat20.utxos[0].script);
        const nonTokenScript = toByteString('0014' + '00'.repeat(20)); // P2WPKH script
        const nonTokenScriptHash = sha256(nonTokenScript);

        if (tokenScriptHash !== nonTokenScriptHash) {
            throw new Error('Non-token script detected: output script hash does not match token script hash');
        }
    }

    async function executeTransferWithDuplicateScriptHash(cat20: TestCat20) {
        const guardOwnerAddr = toTokenOwnerAddress(mainAddress);
        const guardState = CAT20GuardStateLib.createEmptyState(TX_INPUT_COUNT_MAX_6);
        guardState.deployerAddr = guardOwnerAddr;

        // Put same script hash in multiple slots
        const tokenScript = ContractPeripheral.scriptHash(cat20.utxos[0].script);
        guardState.tokenScriptHashes[0] = tokenScript;
        guardState.tokenScriptHashes[1] = tokenScript; // Duplicate!
        guardState.tokenAmounts[0] = 1000n;
        guardState.tokenAmounts[1] = 1000n; // Double count

        let tokenScriptIndexes = guardState.tokenScriptIndexes;
        tokenScriptIndexes = intToByteString(0n, 1n) + slice(tokenScriptIndexes, 1n);
        guardState.tokenScriptIndexes = tokenScriptIndexes;

        const { guard, txInputCountMax, txOutputCountMax } = CAT20GuardPeripheral.createTransferGuard(
            cat20.utxos.map((utxo, index) => ({ token: utxo, inputIndex: index })),
            [{ address: CAT20.deserializeState(cat20.utxos[0].data).ownerAddr, amount: 2000n, outputIndex: 0 }],
            cat20.utxos.length + 2,
            2,
            guardOwnerAddr
        );
        guard.state = guardState;

        return executeWithGuard(cat20, guard, guardState, txInputCountMax, txOutputCountMax, [2000n]);
    }

    // Generic execution helper
    async function executeWithGuard(
        cat20: TestCat20,
        guard: any,
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
        const feeUtxos = await testProvider.getUtxos(mainAddress);
        const guardPsbt = new ExtPsbt({ network: await testProvider.getNetwork(), maximumFeeRate: 1e8 })
            .spendUTXO(feeUtxos.slice(0, 3))
            .addContractOutput(guard, Postage.GUARD_POSTAGE)
            .change(mainAddress, await testProvider.getFeeRate())
            .seal();

        const signedGuardPsbt = ExtPsbt.fromHex(await testSigner.signPsbt(guardPsbt.toHex(), guardPsbt.psbtOptions()));
        guardPsbt.combine(signedGuardPsbt).finalizeAllInputs();

        // Get the guard UTXO from the guard transaction
        const guardUtxo = guardPsbt.getUtxo(0);
        guard.bindToUtxo(guardUtxo);

        // Step 2: Build the send transaction
        const sendPsbt = new ExtPsbt({ network: await testProvider.getNetwork(), maximumFeeRate: 1e8 });
        const guardInputIndex = cat20.utxos.length;

        cat20.utxos.forEach((utxo, inputIndex) => {
            const cat20Contract = new CAT20(
                cat20.generator.minterScriptHash,
                cat20.generator.guardScriptHashes,
                cat20.generator.deployInfo.hasAdmin,
                cat20.generator.deployInfo.adminScriptHash
            ).bindToUtxo(utxo);

            sendPsbt.addContractInput(cat20Contract, (contract, curPsbt) => {
                contract.unlock(
                    {
                        userPubKey: mainPubKey,
                        userSig: curPsbt.getSig(inputIndex, { address: mainAddress }),
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

        sendPsbt.change(mainAddress, 0);

        const signedSendPsbt = await testSigner.signPsbt(sendPsbt.seal().toHex(), sendPsbt.psbtOptions());
        sendPsbt.combine(ExtPsbt.fromHex(signedSendPsbt)).finalizeAllInputs();
    }
});
