/* eslint-disable @typescript-eslint/no-unused-expressions */

import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { isLocalTest } from './utils';
import { testProvider } from './utils/testProvider';
import { loadAllArtifacts as loadAllArtifacts20 } from './features/cat20/utils';
import { loadAllArtifacts as loadAllArtifacts721 } from './features/cat721/utils';
import {
    ByteString,
    ExtPsbt,
    PubKey,
    DefaultSigner,
    bvmVerify,
} from '@opcat-labs/scrypt-ts-opcat';
import { testSigner } from './utils/testSigner';
import {
    CAT20Guard_6_6_2,
    CAT20Guard_6_6_4,
    CAT20Guard_12_12_2,
    CAT20Guard_12_12_4,
    CAT20GuardStateLib,
    CAT20GuardVariant,
    CAT721Guard_6_6_2,
    CAT721Guard_6_6_4,
    CAT721Guard_12_12_2,
    CAT721Guard_12_12_4,
    CAT721GuardStateLib,
    CAT721GuardVariant,
    TX_INPUT_COUNT_MAX_6,
    TX_INPUT_COUNT_MAX_12,
} from '../src/contracts';
import { getDummyUtxo, toTokenOwnerAddress } from '../src/utils';
import { PrivateKey } from '@opcat-labs/opcat';

use(chaiAsPromised);

type GuardClass = typeof CAT20Guard_6_6_2 | typeof CAT20Guard_6_6_4 | typeof CAT20Guard_12_12_2 | typeof CAT20Guard_12_12_4 | typeof CAT721Guard_6_6_2 | typeof CAT721Guard_6_6_4 | typeof CAT721Guard_12_12_2 | typeof CAT721Guard_12_12_4;
type GuardInstance = CAT20GuardVariant | CAT721GuardVariant;

interface GuardTestConfig {
    name: string;
    GuardClass: GuardClass;
    txInputCountMax: typeof TX_INPUT_COUNT_MAX_6 | typeof TX_INPUT_COUNT_MAX_12;
    isNft: boolean;
}

// CAT20 Guard variants
const CAT20_GUARDS: GuardTestConfig[] = [
    { name: 'CAT20Guard_6_6_2', GuardClass: CAT20Guard_6_6_2, txInputCountMax: TX_INPUT_COUNT_MAX_6, isNft: false },
    { name: 'CAT20Guard_6_6_4', GuardClass: CAT20Guard_6_6_4, txInputCountMax: TX_INPUT_COUNT_MAX_6, isNft: false },
    { name: 'CAT20Guard_12_12_2', GuardClass: CAT20Guard_12_12_2, txInputCountMax: TX_INPUT_COUNT_MAX_12, isNft: false },
    { name: 'CAT20Guard_12_12_4', GuardClass: CAT20Guard_12_12_4, txInputCountMax: TX_INPUT_COUNT_MAX_12, isNft: false },
];

// CAT721 Guard variants
const CAT721_GUARDS: GuardTestConfig[] = [
    { name: 'CAT721Guard_6_6_2', GuardClass: CAT721Guard_6_6_2, txInputCountMax: TX_INPUT_COUNT_MAX_6, isNft: true },
    { name: 'CAT721Guard_6_6_4', GuardClass: CAT721Guard_6_6_4, txInputCountMax: TX_INPUT_COUNT_MAX_6, isNft: true },
    { name: 'CAT721Guard_12_12_2', GuardClass: CAT721Guard_12_12_2, txInputCountMax: TX_INPUT_COUNT_MAX_12, isNft: true },
    { name: 'CAT721Guard_12_12_4', GuardClass: CAT721Guard_12_12_4, txInputCountMax: TX_INPUT_COUNT_MAX_12, isNft: true },
];

/**
 * Test Guard destroy method for CAT20 and CAT721 Guards
 */
isLocalTest(testProvider) && describe('Test Guard destroy method', () => {
    let mainAddress: string;
    let mainPubKey: PubKey;
    let mainOwnerAddr: ByteString;

    // Wrong signer for failure tests
    let wrongPubKey: PubKey;
    let wrongOwnerAddr: ByteString;

    before(async () => {
        loadAllArtifacts20();
        loadAllArtifacts721();
        mainAddress = await testSigner.getAddress();
        mainPubKey = PubKey(await testSigner.getPublicKey());
        mainOwnerAddr = toTokenOwnerAddress(mainAddress);

        // Create a different signer for failure tests
        const wrongPrivateKey = PrivateKey.fromRandom('testnet');
        const wrongSigner = new DefaultSigner(wrongPrivateKey);
        const wrongAddress = await wrongSigner.getAddress();
        wrongPubKey = PubKey(await wrongSigner.getPublicKey());
        wrongOwnerAddr = toTokenOwnerAddress(wrongAddress);
    });

    /**
     * Helper function to create a Guard contract bound to a UTXO with ownerAddr
     */
    async function createGuardWithUtxo(config: GuardTestConfig, ownerAddr: ByteString): Promise<GuardInstance> {
        const guard = new config.GuardClass();

        // Create appropriate guard state based on type
        if (config.isNft) {
            const guardState = CAT721GuardStateLib.createEmptyState(config.txInputCountMax);
            guardState.ownerAddr = ownerAddr;
            (guard as CAT721GuardVariant).state = guardState;
        } else {
            const guardState = CAT20GuardStateLib.createEmptyState(config.txInputCountMax);
            guardState.ownerAddr = ownerAddr;
            (guard as CAT20GuardVariant).state = guardState;
        }

        // Create a PSBT to deploy the guard contract
        const guardSatoshis = 1e8;
        const deployPsbt = new ExtPsbt({ network: await testProvider.getNetwork(), maximumFeeRate: 1e8 })
            .spendUTXO(getDummyUtxo(mainAddress))
            .addContractOutput(guard, guardSatoshis)
            .seal();

        const signedPsbtHex = await testSigner.signPsbt(deployPsbt.toHex(), deployPsbt.psbtOptions());
        deployPsbt.combine(ExtPsbt.fromHex(signedPsbtHex)).finalizeAllInputs();

        // Get the UTXO from the deployment transaction and rebind
        const guardUtxo = deployPsbt.getUtxo(0);
        guard.bindToUtxo(guardUtxo);

        return guard;
    }

    /**
     * Helper function to destroy a single Guard
     */
    async function destroySingleGuard(
        guard: GuardInstance,
        signer: DefaultSigner,
        pubKey: PubKey
    ): Promise<ExtPsbt> {
        const address = await signer.getAddress();
        const feeRate = await testProvider.getFeeRate();

        const psbt = new ExtPsbt({ network: await testProvider.getNetwork(), maximumFeeRate: 1e8 })
            .spendUTXO(getDummyUtxo(mainAddress))
            .addContractInput(guard, (contract, tx) => {
                (contract as CAT20GuardVariant | CAT721GuardVariant).destroy(
                    tx.getSig(1, { address }),
                    pubKey
                );
            })
            .change(address, feeRate)
            .seal();

        const signedPsbtHex = await signer.signPsbt(psbt.toHex(), psbt.psbtOptions());
        psbt.combine(ExtPsbt.fromHex(signedPsbtHex)).finalizeAllInputs();

        return psbt;
    }

    /**
     * Helper function to destroy multiple Guards in a single transaction
     */
    async function destroyMultipleGuards(
        guards: GuardInstance[],
        signer: DefaultSigner,
        pubKey: PubKey
    ): Promise<ExtPsbt> {
        const address = await signer.getAddress();
        const feeRate = await testProvider.getFeeRate();

        const psbt = new ExtPsbt({ network: await testProvider.getNetwork(), maximumFeeRate: 1e8 });
        psbt.spendUTXO(getDummyUtxo(mainAddress));

        guards.forEach((guard, index) => {
            psbt.addContractInput(guard, (contract, tx) => {
                (contract as CAT20GuardVariant | CAT721GuardVariant).destroy(
                    tx.getSig(index + 1, { address }),
                    pubKey
                );
            });
        });

        psbt.change(address, feeRate).seal();

        const signedPsbtHex = await signer.signPsbt(psbt.toHex(), psbt.psbtOptions());
        psbt.combine(ExtPsbt.fromHex(signedPsbtHex)).finalizeAllInputs();

        return psbt;
    }

    /**
     * Verify transaction is valid
     */
    function verifyTx(psbt: ExtPsbt) {
        const inputCount = psbt.txInputs.length;
        for (let i = 0; i < inputCount; i++) {
            expect(bvmVerify(psbt, i)).to.eq(true);
        }
    }

    describe('CAT20 Guard destroy tests', () => {
        CAT20_GUARDS.forEach((config) => {
            describe(config.name, () => {
                it('should successfully destroy guard with correct owner signature', async () => {
                    const guard = await createGuardWithUtxo(config, mainOwnerAddr);
                    const destroyPsbt = await destroySingleGuard(guard, testSigner, mainPubKey);
                    expect(destroyPsbt.isFinalized).to.be.true;
                    verifyTx(destroyPsbt);
                });

                it('should fail to destroy guard with wrong public key', async () => {
                    const guard = await createGuardWithUtxo(config, mainOwnerAddr);
                    await expect(destroySingleGuard(guard, testSigner, wrongPubKey)).to.be.rejected;
                });

                it('should fail to destroy guard with non-owner signer', async () => {
                    const guard = await createGuardWithUtxo(config, wrongOwnerAddr);
                    await expect(destroySingleGuard(guard, testSigner, mainPubKey)).to.be.rejected;
                });
            });
        });
    });

    describe('CAT721 Guard destroy tests', () => {
        CAT721_GUARDS.forEach((config) => {
            describe(config.name, () => {
                it('should successfully destroy guard with correct owner signature', async () => {
                    const guard = await createGuardWithUtxo(config, mainOwnerAddr);
                    const destroyPsbt = await destroySingleGuard(guard, testSigner, mainPubKey);
                    expect(destroyPsbt.isFinalized).to.be.true;
                    verifyTx(destroyPsbt);
                });

                it('should fail to destroy guard with wrong public key', async () => {
                    const guard = await createGuardWithUtxo(config, mainOwnerAddr);
                    await expect(destroySingleGuard(guard, testSigner, wrongPubKey)).to.be.rejected;
                });

                it('should fail to destroy guard with non-owner signer', async () => {
                    const guard = await createGuardWithUtxo(config, wrongOwnerAddr);
                    await expect(destroySingleGuard(guard, testSigner, mainPubKey)).to.be.rejected;
                });
            });
        });
    });

    describe('Multiple Guards destroy tests', () => {
        it('should destroy multiple CAT20 Guards in a single transaction', async () => {
            const guard1 = await createGuardWithUtxo(CAT20_GUARDS[0], mainOwnerAddr);
            const guard2 = await createGuardWithUtxo(CAT20_GUARDS[1], mainOwnerAddr);

            const destroyPsbt = await destroyMultipleGuards([guard1, guard2], testSigner, mainPubKey);

            expect(destroyPsbt.isFinalized).to.be.true;
            verifyTx(destroyPsbt);
        });

        it('should destroy multiple CAT721 Guards in a single transaction', async () => {
            const guard1 = await createGuardWithUtxo(CAT721_GUARDS[0], mainOwnerAddr);
            const guard2 = await createGuardWithUtxo(CAT721_GUARDS[1], mainOwnerAddr);

            const destroyPsbt = await destroyMultipleGuards([guard1, guard2], testSigner, mainPubKey);

            expect(destroyPsbt.isFinalized).to.be.true;
            verifyTx(destroyPsbt);
        });

        it('should destroy mixed CAT20 and CAT721 Guards in a single transaction', async () => {
            const cat20Guard = await createGuardWithUtxo(CAT20_GUARDS[0], mainOwnerAddr);
            const cat721Guard = await createGuardWithUtxo(CAT721_GUARDS[0], mainOwnerAddr);

            const destroyPsbt = await destroyMultipleGuards([cat20Guard, cat721Guard], testSigner, mainPubKey);

            expect(destroyPsbt.isFinalized).to.be.true;
            verifyTx(destroyPsbt);
        });

        it('should destroy multiple 12_12 Guards in a single transaction', async () => {
            const guard1 = await createGuardWithUtxo(CAT20_GUARDS[2], mainOwnerAddr);  // CAT20Guard_12_12_2
            const guard2 = await createGuardWithUtxo(CAT721_GUARDS[2], mainOwnerAddr); // CAT721Guard_12_12_2

            const destroyPsbt = await destroyMultipleGuards([guard1, guard2], testSigner, mainPubKey);

            expect(destroyPsbt.isFinalized).to.be.true;
            verifyTx(destroyPsbt);
        });
    });
});
