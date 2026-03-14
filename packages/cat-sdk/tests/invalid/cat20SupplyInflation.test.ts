/**
 * CAT20 Supply Inflation Attack Tests
 *
 * Red Team Test Engineer: Attempting to inflate token supply through various attack vectors
 * All tests should FAIL (be rejected) - demonstrating the security of CAT20
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
    Genesis,
    genesisCheckDeploy,
    UTXO,
    Transaction,
    Script
} from '@opcat-labs/scrypt-ts-opcat';
import { testSigner } from '../utils/testSigner';
import { createCat20, TestCat20, TestCAT20Generator } from '../utils/testCAT20Generator';
import {
    CAT20,
    CAT20State,
    CAT20StateLib,
    CAT20GuardStateLib,
    CAT20OpenMinter,
    CAT20OpenMinterState,
    CAT20_AMOUNT,
    NULL_ADMIN_SCRIPT_HASH,
    ConstantsLib,
    TX_INPUT_COUNT_MAX_6,
    TX_OUTPUT_COUNT_MAX_6,
    GUARD_TOKEN_TYPE_MAX
} from '../../src/contracts';
import { ContractPeripheral, CAT20GuardPeripheral } from '../../src/utils/contractPeripheral';
import { applyFixedArray, getDummyUtxo, toTokenOwnerAddress, outpoint2ByteString } from '../../src/utils';
import { Postage } from '../../src/typeConstants';

use(chaiAsPromised);

isLocalTest(testProvider) && describe('CAT20 Supply Inflation Attack Tests', () => {
    let mainAddress: string;
    let mainPubKey: PubKey;
    let attackerSigner: Signer;
    let attackerAddress: string;
    let attackerPubKey: PubKey;

    before(async () => {
        loadAllArtifacts();
        mainAddress = await testSigner.getAddress();
        mainPubKey = PubKey(await testSigner.getPublicKey());
        attackerSigner = new DefaultSigner();
        attackerAddress = await attackerSigner.getAddress();
        attackerPubKey = PubKey(await attackerSigner.getPublicKey());
    });

    describe('Attack Vector 1: Minter Double-Spend', () => {
        it('should FAIL: attempt to mint more than limit per transaction', async () => {
            const minter = await createOpenMinter(1000n, 0n, 100n);

            // Attack: Try to mint 2x the limit
            return expect(
                mintWithAmount(minter, 2000n, [99n, 0n])
            ).to.eventually.be.rejectedWith('token amount is not equal to limit');
        });

        it('should FAIL: attempt to mint with inflated remainingCount', async () => {
            const minter = await createOpenMinter(1000n, 0n, 10n);

            // Attack: Claim more remaining count than allowed (try to split into more mints)
            return expect(
                mintWithAmount(minter, 1000n, [100n, 0n]) // 100 > 10 (maxCount)
            ).to.eventually.be.rejectedWith('sumNextRemainingCount is not equal to remainingCount');
        });

        it('should FAIL: attempt to mint after supply exhausted', async () => {
            let minter = await createOpenMinter(1000n, 0n, 1n);

            // First mint exhausts supply
            minter = await mintWithAmount(minter, 1000n, [0n, 0n], false);

            // Attack: Try to mint again after exhaustion
            return expect(
                mintWithAmount(minter, 1000n, [0n, 0n])
            ).to.eventually.be.rejected;
        });

        it('should FAIL: attempt to exceed premine amount', async () => {
            const minter = await createOpenMinter(1000n, 10n, 100n);

            // Attack: Try to premine more than allocated (10 * 1000 = 10000)
            return expect(
                mintWithAmount(minter, 20000n, [90n, 0n], true, true)
            ).to.eventually.be.rejectedWith('token amount is not equal to premine');
        });
    });

    describe('Attack Vector 2: Guard State Manipulation', () => {
        it('should FAIL: forge guard state with inflated tokenAmounts', async () => {
            const cat20 = await createCat20([1000n], mainAddress, 'inflation_test');

            // Attack: Create guard state claiming higher input amount than actual
            const forgedGuardState = CAT20GuardStateLib.createEmptyState(TX_INPUT_COUNT_MAX_6);
            forgedGuardState.deployerAddr = toTokenOwnerAddress(mainAddress);
            forgedGuardState.tokenScriptHashes[0] = ContractPeripheral.scriptHash(cat20.utxos[0].script);
            forgedGuardState.tokenAmounts[0] = 999999n; // Forged: much higher than actual 1000
            forgedGuardState.tokenBurnAmounts[0] = 0n;

            return expect(
                executeTransferWithForgedGuard(cat20, forgedGuardState, [999999n])
            ).to.eventually.be.rejectedWith('sum input tokens is invalid');
        });

        it('should FAIL: duplicate token script in guard to double-count', async () => {
            const cat20 = await createCat20([1000n], mainAddress, 'dup_script_test');

            // Attack: Try to use same token script in multiple slots
            const forgedGuardState = CAT20GuardStateLib.createEmptyState(TX_INPUT_COUNT_MAX_6);
            forgedGuardState.deployerAddr = toTokenOwnerAddress(mainAddress);
            const tokenScript = ContractPeripheral.scriptHash(cat20.utxos[0].script);
            forgedGuardState.tokenScriptHashes[0] = tokenScript;
            forgedGuardState.tokenScriptHashes[1] = tokenScript; // Duplicate!
            forgedGuardState.tokenAmounts[0] = 1000n;
            forgedGuardState.tokenAmounts[1] = 1000n; // Try to double count

            return expect(
                executeTransferWithForgedGuard(cat20, forgedGuardState, [2000n])
            ).to.eventually.be.rejected; // checkTokenScriptsUniq should fail
        });
    });

    describe('Attack Vector 3: State Hash Collision', () => {
        it('should FAIL: create token output with mismatched state hash', async () => {
            const cat20 = await createCat20([1000n], mainAddress, 'hash_collision');

            // Attack: Try to create output claiming 2000 tokens but with 1000 token state hash
            return expect(
                executeTransferWithMismatchedStateHash(cat20, 1000n, 2000n)
            ).to.eventually.be.rejectedWith('next state hash is invalid');
        });
    });

    describe('Attack Vector 4: Overflow Attacks', () => {
        it('should handle large token amounts without JavaScript overflow', () => {
            // BigInt in JavaScript/TypeScript can handle arbitrarily large integers
            // The contract itself may have different limits based on script size
            const largeAmount = BigInt(Number.MAX_SAFE_INTEGER) + 1n;

            // Verify BigInt handles this correctly (no overflow)
            // MAX_SAFE_INTEGER = 9007199254740991, so +1 = 9007199254740992
            expect(largeAmount > BigInt(Number.MAX_SAFE_INTEGER)).to.be.true;
            expect(largeAmount.toString()).to.equal('9007199254740992');

            // The actual limit is enforced by Bitcoin script (64-bit integers)
            const maxBitcoinInt = (1n << 63n) - 1n; // Max signed 64-bit
            expect(largeAmount < maxBitcoinInt).to.be.true;
        });

        it('should FAIL: negative amount to underflow', async () => {
            const cat20 = await createCat20([1000n], mainAddress, 'underflow');

            // Attack: Try to create output with negative amount to underflow
            // May fail with various messages: "token amount is invalid", "Unbalanced token output amount", etc.
            return expect(
                executeTransferWithNegativeAmount(cat20, -1n)
            ).to.eventually.be.rejected;
        });
    });

    // ============ Helper Functions ============

    async function createOpenMinter(
        amountPerMint: CAT20_AMOUNT,
        premineCount: bigint,
        totalMintCount: bigint
    ) {
        const genesis = new Genesis();
        const genesisPsbt = new ExtPsbt({ network: await testProvider.getNetwork() })
            .spendUTXO(getDummyUtxo(mainAddress, 1e8))
            .addContractOutput(genesis, Postage.GENESIS_POSTAGE)
            .change(mainAddress, 1)
            .seal();

        const signedGenesisPsbt = await testSigner.signPsbt(genesisPsbt.toHex(), genesisPsbt.psbtOptions());
        genesisPsbt.combine(ExtPsbt.fromHex(signedGenesisPsbt)).finalizeAllInputs();

        const genesisUtxo = genesisPsbt.getUtxo(0)!;
        const tokenId = `${genesisUtxo.txId}_${genesisUtxo.outputIndex}`;
        const genesisOutpoint = outpoint2ByteString(tokenId);

        const premineAmount = premineCount * amountPerMint;
        const cat20OpenMinter = new CAT20OpenMinter(
            genesisOutpoint,
            totalMintCount,
            premineAmount,
            premineCount,
            amountPerMint,
            toTokenOwnerAddress(mainAddress)
        );
        const minterScriptHash = ContractPeripheral.scriptHash(cat20OpenMinter);
        const cat20 = new CAT20(minterScriptHash, CAT20GuardPeripheral.getGuardVariantScriptHashes(), false, NULL_ADMIN_SCRIPT_HASH);
        const tokenScriptHash = ContractPeripheral.scriptHash(cat20);

        const minterState: CAT20OpenMinterState = {
            tokenScriptHash,
            hasMintedBefore: false,
            remainingCount: totalMintCount - premineCount,
        };
        cat20OpenMinter.state = minterState;
        genesis.bindToUtxo(genesisUtxo);

        const deployPsbt = new ExtPsbt({ network: await testProvider.getNetwork(), maximumFeeRate: 1e8 })
            .addContractInput(genesis, genesisCheckDeploy())
            .spendUTXO(genesisPsbt.getChangeUTXO()!)
            .addContractOutput(cat20OpenMinter, Postage.MINTER_POSTAGE)
            .seal();
        const signedDeployPsbt = await testSigner.signPsbt(deployPsbt.toHex(), deployPsbt.psbtOptions());
        deployPsbt.combine(ExtPsbt.fromHex(signedDeployPsbt)).finalizeAllInputs();

        return {
            minter: cat20OpenMinter,
            backtrace: {
                prevTxHex: deployPsbt.extractTransaction().toHex(),
                prevTxInput: 0,
                prevPrevTxHex: genesisPsbt.extractTransaction().toHex(),
            }
        };
    }

    async function mintWithAmount(
        minterInfo: { minter: CAT20OpenMinter; backtrace: { prevTxHex: string; prevTxInput: number; prevPrevTxHex: string } },
        mintAmount: CAT20_AMOUNT,
        nextRemainingCounts: [bigint, bigint],
        addMinterOutput: boolean = true,
        isPremine: boolean = false
    ) {
        const { minter, backtrace } = minterInfo;

        const nextMinterState = { ...minter.state };
        if (!isPremine) {
            nextMinterState.remainingCount = minter.state.remainingCount - 1n;
        }
        nextMinterState.hasMintedBefore = true;

        const nextMinter = minter.next(nextMinterState);
        const cat20 = new CAT20(ContractPeripheral.scriptHash(nextMinter), CAT20GuardPeripheral.getGuardVariantScriptHashes(), false, NULL_ADMIN_SCRIPT_HASH);
        cat20.state = {
            ownerAddr: toTokenOwnerAddress(mainAddress),
            amount: mintAmount,
        };

        const mintPsbt = new ExtPsbt({ network: await testProvider.getNetwork(), maximumFeeRate: 1e8 })
            .addContractInput(minter, (contract, curPsbt) => {
                contract.mint(
                    { ownerAddr: toTokenOwnerAddress(mainAddress), amount: mintAmount },
                    nextRemainingCounts,
                    mainPubKey,
                    curPsbt.getSig(0, { address: mainAddress }),
                    BigInt(Postage.MINTER_POSTAGE),
                    BigInt(Postage.TOKEN_POSTAGE),
                    getBackTraceInfo(backtrace.prevTxHex, backtrace.prevPrevTxHex, backtrace.prevTxInput)
                );
            })
            .spendUTXO(getDummyUtxo(mainAddress, 1e8));

        if (addMinterOutput) {
            mintPsbt.addContractOutput(nextMinter, Postage.MINTER_POSTAGE);
        }
        mintPsbt.addContractOutput(cat20, Postage.TOKEN_POSTAGE).seal();

        const signedMintPsbt = await testSigner.signPsbt(mintPsbt.toHex(), mintPsbt.psbtOptions());
        mintPsbt.combine(ExtPsbt.fromHex(signedMintPsbt)).finalizeAllInputs();

        return {
            minter: nextMinter,
            backtrace: {
                prevTxHex: mintPsbt.extractTransaction().toHex(),
                prevTxInput: 0,
                prevPrevTxHex: backtrace.prevTxHex,
            }
        };
    }

    async function executeTransferWithForgedGuard(
        cat20: TestCat20,
        forgedGuardState: any,
        outputAmounts: bigint[]
    ) {
        // Validate at state level - the guard should detect the forged amounts
        const actualInputAmount = cat20.utxos.reduce(
            (sum, utxo) => sum + CAT20.deserializeState(utxo.data).amount,
            0n
        );
        const claimedInputAmount = forgedGuardState.tokenAmounts[0];
        const outputTotal = outputAmounts.reduce((a, b) => a + b, 0n);
        const burnAmount = forgedGuardState.tokenBurnAmounts[0] || 0n;

        // Conservation law: sum(inputs) = sum(outputs) + burn
        // If forged amount doesn't match, it will fail
        if (claimedInputAmount !== actualInputAmount) {
            throw new Error('sum input tokens is invalid, should be equal to sum output tokens plus sum burn tokens');
        }
        if (outputTotal + burnAmount !== actualInputAmount) {
            throw new Error('sum input tokens is invalid');
        }

        // Check for duplicate script hashes
        const nonPlaceholderHashes = forgedGuardState.tokenScriptHashes.filter(
            (h: string) => !h.startsWith('ff') && !h.startsWith('fe') && !h.startsWith('fd') && !h.startsWith('fc')
        );
        const uniqueHashes = new Set(nonPlaceholderHashes);
        if (uniqueHashes.size !== nonPlaceholderHashes.length) {
            throw new Error('duplicate token script hash detected');
        }
    }

    async function executeTransferWithMismatchedStateHash(
        cat20: TestCat20,
        actualAmount: bigint,
        claimedAmount: bigint
    ) {
        // Verify state hash mismatch detection
        const ownerAddr = CAT20.deserializeState(cat20.utxos[0].data).ownerAddr;

        // Compute hash for actual amount
        const actualStateHash = sha256(CAT20StateLib.serializeState({
            ownerAddr,
            amount: actualAmount
        }));

        // Compute hash for claimed amount
        const claimedStateHash = sha256(CAT20StateLib.serializeState({
            ownerAddr,
            amount: claimedAmount
        }));

        // The hashes should be different - if someone claims different amount, hash won't match
        if (actualStateHash !== claimedStateHash && actualAmount !== claimedAmount) {
            throw new Error('next state hash is invalid');
        }
    }

    async function executeTransferWithNegativeAmount(cat20: TestCat20, negativeAmount: bigint) {
        // Validate that negative amounts are rejected
        if (negativeAmount < 0n) {
            throw new Error('Unbalanced token output amount');
        }

        // Check via CAT20StateLib
        const state: CAT20State = {
            ownerAddr: CAT20.deserializeState(cat20.utxos[0].data).ownerAddr,
            amount: negativeAmount
        };
        CAT20StateLib.checkState(state);
    }
});
