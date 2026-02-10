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
import { destroyCAT20Guard } from '../src/features/cat20';
import { destroyCAT721Guard } from '../src/features/cat721';

use(chaiAsPromised);

type CAT20GuardClass = typeof CAT20Guard_6_6_2 | typeof CAT20Guard_6_6_4 | typeof CAT20Guard_12_12_2 | typeof CAT20Guard_12_12_4;
type CAT721GuardClass = typeof CAT721Guard_6_6_2 | typeof CAT721Guard_6_6_4 | typeof CAT721Guard_12_12_2 | typeof CAT721Guard_12_12_4;

interface CAT20GuardTestConfig {
    name: string;
    GuardClass: CAT20GuardClass;
    txInputCountMax: typeof TX_INPUT_COUNT_MAX_6 | typeof TX_INPUT_COUNT_MAX_12;
}

interface CAT721GuardTestConfig {
    name: string;
    GuardClass: CAT721GuardClass;
    txInputCountMax: typeof TX_INPUT_COUNT_MAX_6 | typeof TX_INPUT_COUNT_MAX_12;
}

// CAT20 Guard variants
const CAT20_GUARDS: CAT20GuardTestConfig[] = [
    { name: 'CAT20Guard_6_6_2', GuardClass: CAT20Guard_6_6_2, txInputCountMax: TX_INPUT_COUNT_MAX_6 },
    { name: 'CAT20Guard_6_6_4', GuardClass: CAT20Guard_6_6_4, txInputCountMax: TX_INPUT_COUNT_MAX_6 },
    { name: 'CAT20Guard_12_12_2', GuardClass: CAT20Guard_12_12_2, txInputCountMax: TX_INPUT_COUNT_MAX_12 },
    { name: 'CAT20Guard_12_12_4', GuardClass: CAT20Guard_12_12_4, txInputCountMax: TX_INPUT_COUNT_MAX_12 },
];

// CAT721 Guard variants
const CAT721_GUARDS: CAT721GuardTestConfig[] = [
    { name: 'CAT721Guard_6_6_2', GuardClass: CAT721Guard_6_6_2, txInputCountMax: TX_INPUT_COUNT_MAX_6 },
    { name: 'CAT721Guard_6_6_4', GuardClass: CAT721Guard_6_6_4, txInputCountMax: TX_INPUT_COUNT_MAX_6 },
    { name: 'CAT721Guard_12_12_2', GuardClass: CAT721Guard_12_12_2, txInputCountMax: TX_INPUT_COUNT_MAX_12 },
    { name: 'CAT721Guard_12_12_4', GuardClass: CAT721Guard_12_12_4, txInputCountMax: TX_INPUT_COUNT_MAX_12 },
];

/**
 * Test Guard destroy method for CAT20 and CAT721 Guards
 */
isLocalTest(testProvider) && describe('Test Guard destroy method', () => {
    let mainAddress: string;
    let mainDeployerAddr: ByteString;

    // Wrong signer for failure tests
    let wrongSigner: DefaultSigner;
    let wrongDeployerAddr: ByteString;

    before(async () => {
        loadAllArtifacts20();
        loadAllArtifacts721();
        mainAddress = await testSigner.getAddress();
        mainDeployerAddr = toTokenOwnerAddress(mainAddress);

        // Create a different signer for failure tests
        const wrongPrivateKey = PrivateKey.fromRandom('testnet');
        wrongSigner = new DefaultSigner(wrongPrivateKey);
        const wrongAddress = await wrongSigner.getAddress();
        wrongDeployerAddr = toTokenOwnerAddress(wrongAddress);
    });

    /**
     * Helper function to create a CAT20 Guard contract bound to a UTXO with deployerAddr
     */
    async function createCAT20GuardWithUtxo(config: CAT20GuardTestConfig, deployerAddr: ByteString): Promise<CAT20GuardVariant> {
        const guard = new config.GuardClass();
        const guardState = CAT20GuardStateLib.createEmptyState(config.txInputCountMax);
        guardState.deployerAddr = deployerAddr;
        guard.state = guardState;

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
     * Helper function to create a CAT721 Guard contract bound to a UTXO with deployerAddr
     */
    async function createCAT721GuardWithUtxo(config: CAT721GuardTestConfig, deployerAddr: ByteString): Promise<CAT721GuardVariant> {
        const guard = new config.GuardClass();
        const guardState = CAT721GuardStateLib.createEmptyState(config.txInputCountMax);
        guardState.deployerAddr = deployerAddr;
        guard.state = guardState;

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
                    const guard = await createCAT20GuardWithUtxo(config, mainDeployerAddr);
                    const feeRate = await testProvider.getFeeRate();

                    const { destroyPsbt } = await destroyCAT20Guard.dryRun(
                        testSigner,
                        testProvider,
                        [guard],
                        feeRate
                    );

                    expect(destroyPsbt.isFinalized).to.be.true;
                    verifyTx(destroyPsbt);
                });

                it('should fail to destroy guard with non-owner signer', async () => {
                    const guard = await createCAT20GuardWithUtxo(config, wrongDeployerAddr);
                    const feeRate = await testProvider.getFeeRate();

                    await expect(
                        destroyCAT20Guard.dryRun(testSigner, testProvider, [guard], feeRate)
                    ).to.be.rejected;
                });
            });
        });
    });

    describe('CAT721 Guard destroy tests', () => {
        CAT721_GUARDS.forEach((config) => {
            describe(config.name, () => {
                it('should successfully destroy guard with correct owner signature', async () => {
                    const guard = await createCAT721GuardWithUtxo(config, mainDeployerAddr);
                    const feeRate = await testProvider.getFeeRate();

                    const { destroyPsbt } = await destroyCAT721Guard.dryRun(
                        testSigner,
                        testProvider,
                        [guard],
                        feeRate
                    );

                    expect(destroyPsbt.isFinalized).to.be.true;
                    verifyTx(destroyPsbt);
                });

                it('should fail to destroy guard with non-owner signer', async () => {
                    const guard = await createCAT721GuardWithUtxo(config, wrongDeployerAddr);
                    const feeRate = await testProvider.getFeeRate();

                    await expect(
                        destroyCAT721Guard.dryRun(testSigner, testProvider, [guard], feeRate)
                    ).to.be.rejected;
                });
            });
        });
    });

    describe('Multiple Guards destroy tests', () => {
        it('should destroy multiple CAT20 Guards in a single transaction', async () => {
            const guard1 = await createCAT20GuardWithUtxo(CAT20_GUARDS[0], mainDeployerAddr);
            const guard2 = await createCAT20GuardWithUtxo(CAT20_GUARDS[1], mainDeployerAddr);
            const feeRate = await testProvider.getFeeRate();

            const { destroyPsbt } = await destroyCAT20Guard.dryRun(
                testSigner,
                testProvider,
                [guard1, guard2],
                feeRate
            );

            expect(destroyPsbt.isFinalized).to.be.true;
            verifyTx(destroyPsbt);
        });

        it('should destroy multiple CAT721 Guards in a single transaction', async () => {
            const guard1 = await createCAT721GuardWithUtxo(CAT721_GUARDS[0], mainDeployerAddr);
            const guard2 = await createCAT721GuardWithUtxo(CAT721_GUARDS[1], mainDeployerAddr);
            const feeRate = await testProvider.getFeeRate();

            const { destroyPsbt } = await destroyCAT721Guard.dryRun(
                testSigner,
                testProvider,
                [guard1, guard2],
                feeRate
            );

            expect(destroyPsbt.isFinalized).to.be.true;
            verifyTx(destroyPsbt);
        });

        it('should destroy multiple 12_12 CAT20 Guards in a single transaction', async () => {
            const guard1 = await createCAT20GuardWithUtxo(CAT20_GUARDS[2], mainDeployerAddr);  // CAT20Guard_12_12_2
            const guard2 = await createCAT20GuardWithUtxo(CAT20_GUARDS[3], mainDeployerAddr);  // CAT20Guard_12_12_4
            const feeRate = await testProvider.getFeeRate();

            const { destroyPsbt } = await destroyCAT20Guard.dryRun(
                testSigner,
                testProvider,
                [guard1, guard2],
                feeRate
            );

            expect(destroyPsbt.isFinalized).to.be.true;
            verifyTx(destroyPsbt);
        });

        it('should destroy multiple 12_12 CAT721 Guards in a single transaction', async () => {
            const guard1 = await createCAT721GuardWithUtxo(CAT721_GUARDS[2], mainDeployerAddr);  // CAT721Guard_12_12_2
            const guard2 = await createCAT721GuardWithUtxo(CAT721_GUARDS[3], mainDeployerAddr);  // CAT721Guard_12_12_4
            const feeRate = await testProvider.getFeeRate();

            const { destroyPsbt } = await destroyCAT721Guard.dryRun(
                testSigner,
                testProvider,
                [guard1, guard2],
                feeRate
            );

            expect(destroyPsbt.isFinalized).to.be.true;
            verifyTx(destroyPsbt);
        });
    });
});
