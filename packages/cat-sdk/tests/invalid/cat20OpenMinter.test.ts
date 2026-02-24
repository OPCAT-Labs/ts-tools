import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { isLocalTest } from '../utils';
import { testProvider } from '../utils/testProvider';
import { loadAllArtifacts } from '../features/cat20/utils';
import { assert, DefaultSigner, ExtPsbt, fill, getBackTraceInfo, IExtPsbt, PubKey, sha256, Signer, toByteString, toHex, uint8ArrayToHex, UTXO, Genesis, genesisCheckDeploy } from '@opcat-labs/scrypt-ts-opcat';
import { testSigner } from '../utils/testSigner';
import { createCat721, TestCat721 } from '../utils/testCAT721Generator';
import { CAT20, CAT20_AMOUNT, CAT20GuardStateLib, CAT20OpenMinter, CAT20OpenMinterState, CAT20State, CAT20StateLib, CAT721, CAT721GuardStateLib, CAT721State, CAT721StateLib, ConstantsLib, TX_INPUT_COUNT_MAX, TX_OUTPUT_COUNT_MAX, NULL_ADMIN_SCRIPT_HASH } from '../../src/contracts';
import { ContractPeripheral, CAT20GuardPeripheral } from '../../src/utils/contractPeripheral';
import { applyFixedArray, getDummyUtxo, outpoint2ByteString, toTokenOwnerAddress } from '../../src/utils';
import { Postage } from '../../src/typeConstants';
use(chaiAsPromised)

type MinterInfo = {
    minter: CAT20OpenMinter,
    backtrace: {
        prevTxHex: string,
        prevTxInput: number,
        prevPrevTxHex: string,
    }
}
isLocalTest(testProvider) && describe('Test invalid mint for cat20OpenMinter', () => {
    let mainAddress: string;
    let mainPubKey: PubKey
    let mainSigner: Signer = testSigner;
    let signer2: Signer = new DefaultSigner()
    let signer2PubKey: PubKey;
    let signer2Address: string;

    before(async () => {
        loadAllArtifacts();
        mainAddress = await mainSigner.getAddress();
        mainPubKey = PubKey(await mainSigner.getPublicKey());
        signer2Address = await signer2.getAddress();
        signer2PubKey = PubKey(await signer2.getPublicKey());
    });

    describe('should succeed when all is set correctly', async () => {
        let minter: MinterInfo;

        before(async () => {
            minter = await createMinter(
                BigInt(1e3),
                10n,
                100n,
            );
        });

        it('should succeed when premine', async () => {
            minter = await mint(minter, BigInt(1e3 * 10), (contract, curPsbt) => {
                contract.mint(
                    {
                        ownerAddr: toTokenOwnerAddress(mainAddress),
                        amount: BigInt(1e3 * 10),
                    },
                    [90n, 0n],
                    mainPubKey,
                    curPsbt.getSig(0, { address: mainAddress }),
                    BigInt(Postage.MINTER_POSTAGE),
                    BigInt(Postage.TOKEN_POSTAGE),
                    getBackTraceInfo(minter.backtrace.prevTxHex, minter.backtrace.prevPrevTxHex, minter.backtrace.prevTxInput)
                )
            });
        })

        it('should succeed when mint', async () => {
            minter = await mint(minter, BigInt(1e3), (contract, curPsbt) => {
                contract.mint(
                    {
                        ownerAddr: toTokenOwnerAddress(mainAddress),
                        amount: BigInt(1e3),
                    },
                    [89n, 0n],
                    mainPubKey,
                    curPsbt.getSig(0, { address: mainAddress }),
                    BigInt(Postage.MINTER_POSTAGE),
                    BigInt(Postage.TOKEN_POSTAGE),
                    getBackTraceInfo(minter.backtrace.prevTxHex, minter.backtrace.prevPrevTxHex, minter.backtrace.prevTxInput)
                )
            });
        })
    })


    it('should premine fail when preminer sig is invalid', async () => {
        let minter = await createMinter(
            BigInt(1e3),
            10n,
            100n,
        );

        try {
            await mint(minter, BigInt(1e3 * 10), (contract, curPsbt) => {
                contract.mint(
                    {
                        ownerAddr: toTokenOwnerAddress(mainAddress),
                        amount: BigInt(1e3 * 10),
                    },
                    [90n, 0n],
                    mainPubKey,
                    curPsbt.getSig(0, { address: signer2Address }),
                    BigInt(Postage.MINTER_POSTAGE),
                    BigInt(Postage.TOKEN_POSTAGE),
                    getBackTraceInfo(minter.backtrace.prevTxHex, minter.backtrace.prevPrevTxHex, minter.backtrace.prevTxInput)
                )
            })
        } catch (error) {
            expect(error.message.includes('signature check failed')).to.be.true
        }
    })

    it('should premine fail when preminer pubkey is invalid', async () => {
        let minter = await createMinter(
            BigInt(1e3),
            10n,
            100n,
        );

        try {
            await mint(minter, BigInt(1e3 * 10), (contract, curPsbt) => {
                contract.mint(
                    {
                        ownerAddr: toTokenOwnerAddress(mainAddress),
                        amount: BigInt(1e3 * 10),
                    },
                    [90n, 0n],
                    signer2PubKey,
                    curPsbt.getSig(0, { address: signer2Address }),
                    BigInt(Postage.MINTER_POSTAGE),
                    BigInt(Postage.TOKEN_POSTAGE),
                    getBackTraceInfo(minter.backtrace.prevTxHex, minter.backtrace.prevPrevTxHex, minter.backtrace.prevTxInput)
                )
            })
        } catch (error) {
            expect(error.message.includes('owner address is not match to the pubkey')).to.be.true;
        }
    })

    it('should premine fail when the preminer has mined', async () => {
        let minter = await createMinter(
            BigInt(1e3),
            10n,
            100n,
        );
        minter = await mint(minter, BigInt(1e3 * 10), (contract, curPsbt) => {
            contract.mint(
                {
                    ownerAddr: toTokenOwnerAddress(mainAddress),
                    amount: BigInt(1e3 * 10),
                },
                [90n, 0n],
                mainPubKey,
                curPsbt.getSig(0, { address: mainAddress }),
                BigInt(Postage.MINTER_POSTAGE),
                BigInt(Postage.TOKEN_POSTAGE),
                getBackTraceInfo(minter.backtrace.prevTxHex, minter.backtrace.prevPrevTxHex, minter.backtrace.prevTxInput)
            )
        });

        try {
            await mint(minter, BigInt(1e3 * 10), (contract, curPsbt) => {
                contract.mint(
                    {
                        ownerAddr: toTokenOwnerAddress(mainAddress),
                        amount: BigInt(1e3 * 10),
                    },
                    [89n, 0n],
                    mainPubKey,
                    curPsbt.getSig(0, { address: mainAddress }),
                    BigInt(Postage.MINTER_POSTAGE),
                    BigInt(Postage.TOKEN_POSTAGE),
                    getBackTraceInfo(minter.backtrace.prevTxHex, minter.backtrace.prevPrevTxHex, minter.backtrace.prevTxInput)
                )
            });
        } catch (error) {
            expect(error.message.includes('token amount is not equal to limit')).to.be.true;
        }
    })

    it('should premine fail when the premineCount is 0', async () => {
        let minter = await createMinter(
            BigInt(1e3),
            0n,
            100n,
        );

        try {
            await mint(minter, BigInt(1e3 * 10), (contract, curPsbt) => {
                contract.mint(
                    {
                        ownerAddr: toTokenOwnerAddress(mainAddress),
                        amount: BigInt(1e3 * 10),
                    },
                    [90n, 0n],
                    mainPubKey,
                    curPsbt.getSig(0, { address: mainAddress }),
                    BigInt(Postage.MINTER_POSTAGE),
                    BigInt(Postage.TOKEN_POSTAGE),
                    getBackTraceInfo(minter.backtrace.prevTxHex, minter.backtrace.prevPrevTxHex, minter.backtrace.prevTxInput)
                )
            });
        } catch (error) {
            expect(error.message.includes('sumNextRemainingCount is not equal to remainingCount - 1')).to.be.true;
        }
    })


    it('should fail when premine amount is wrong', async () => {
        let minter = await createMinter(
            BigInt(1e3),
            10n,
            100n,
        );

        try {
            await mint(minter, BigInt(1e3 * 11), (contract, curPsbt) => {
                contract.mint(
                    {
                        ownerAddr: toTokenOwnerAddress(mainAddress),
                        amount: BigInt(1e3 * 11),
                    },
                    [90n, 0n],
                    mainPubKey,
                    curPsbt.getSig(0, { address: mainAddress }),
                    BigInt(Postage.MINTER_POSTAGE),
                    BigInt(Postage.TOKEN_POSTAGE),
                    getBackTraceInfo(minter.backtrace.prevTxHex, minter.backtrace.prevPrevTxHex, minter.backtrace.prevTxInput)
                )
            });
        } catch (error) {
            expect(error.message.includes('token amount is not equal to premine')).to.be.true;
        }
    })


    it('should fail when mint amount is wrong', async () => {

        let minter = await createMinter(
            BigInt(1e3),
            0n,
            100n,
        );

        try {
            await mint(minter, BigInt(1e3 * 2), (contract, curPsbt) => {
                contract.mint(
                    {
                        ownerAddr: toTokenOwnerAddress(mainAddress),
                        amount: BigInt(1e3 * 2),
                    },
                    [99n, 0n],
                    mainPubKey,
                    curPsbt.getSig(0, { address: mainAddress }),
                    BigInt(Postage.MINTER_POSTAGE),
                    BigInt(Postage.TOKEN_POSTAGE),
                    getBackTraceInfo(minter.backtrace.prevTxHex, minter.backtrace.prevPrevTxHex, minter.backtrace.prevTxInput)
                )
            });
        } catch (error) {
            expect(error.message.includes('token amount is not equal to limit')).to.be.true;
        }
    })

    it('should fail when no token left in minter', async () => {
        // allowed 2 mints
        let minter = await createMinter(
            BigInt(1e3),
            0n,
            2n,
        );

        // the first mint
        minter = await mint(minter, BigInt(1e3), (contract, curPsbt) => {
            contract.mint(
                {
                    ownerAddr: toTokenOwnerAddress(mainAddress),
                    amount: BigInt(1e3),
                },
                [1n, 0n],
                mainPubKey,
                curPsbt.getSig(0, { address: mainAddress }),
                BigInt(Postage.MINTER_POSTAGE),
                BigInt(Postage.TOKEN_POSTAGE),
                getBackTraceInfo(minter.backtrace.prevTxHex, minter.backtrace.prevPrevTxHex, minter.backtrace.prevTxInput)
            )
        });

        // the second mint should succeed if do not add minter output
        await mint(minter, BigInt(1e3), (contract, curPsbt) => {
            contract.mint(
                {
                    ownerAddr: toTokenOwnerAddress(mainAddress),
                    amount: BigInt(1e3),
                },
                [0n, 0n],
                mainPubKey,
                curPsbt.getSig(0, { address: mainAddress }),
                BigInt(Postage.MINTER_POSTAGE),
                BigInt(Postage.TOKEN_POSTAGE),
                getBackTraceInfo(minter.backtrace.prevTxHex, minter.backtrace.prevPrevTxHex, minter.backtrace.prevTxInput)
            )
        }, false);

        try {
            // the second mint should fail when forcing add minter output after all token minted
            minter = await mint(minter, BigInt(1e3), (contract, curPsbt) => {
                contract.mint(
                    {
                        ownerAddr: toTokenOwnerAddress(mainAddress),
                        amount: BigInt(1e3),
                    },
                    [1n, 0n],
                    mainPubKey,
                    curPsbt.getSig(0, { address: mainAddress }),
                    BigInt(Postage.MINTER_POSTAGE),
                    BigInt(Postage.TOKEN_POSTAGE),
                    getBackTraceInfo(minter.backtrace.prevTxHex, minter.backtrace.prevPrevTxHex, minter.backtrace.prevTxInput)
                )
            });
        } catch (error) {
            expect(error.message.includes('sumNextRemainingCount is not equal to remainingCount - 1')).to.be.true;
        }

        try {
            // the second mint should fail when forcing add minter output with 0 remaining count
            minter = await mint(minter, BigInt(1e3), (contract, curPsbt) => {
                contract.mint(
                    {
                        ownerAddr: toTokenOwnerAddress(mainAddress),
                        amount: BigInt(1e3),
                    },
                    [0n, 0n],
                    mainPubKey,
                    curPsbt.getSig(0, { address: mainAddress }),
                    BigInt(Postage.MINTER_POSTAGE),
                    BigInt(Postage.TOKEN_POSTAGE),
                    getBackTraceInfo(minter.backtrace.prevTxHex, minter.backtrace.prevPrevTxHex, minter.backtrace.prevTxInput)
                )
            });
        } catch (error) {
            expect(error.message.includes('outputs are invalid')).to.be.true;
        }
    })


    async function createMinter(
        amountPerMint: CAT20_AMOUNT,   // limit
        premineCount: bigint,
        totalMintCount: bigint,
    ): Promise<MinterInfo> {
        assert(premineCount <= totalMintCount);

        // Create Genesis contract for proper backtrace validation
        const genesis = new Genesis();

        const genesisPsbt = new ExtPsbt({ network: await testProvider.getNetwork() })
            .spendUTXO(getDummyUtxo(mainAddress, 1e8))
            .addContractOutput(genesis, Postage.GENESIS_POSTAGE)
            .change(mainAddress, 1)
            .seal()

        const signedGenesisPsbt = await mainSigner.signPsbt(genesisPsbt.toHex(), genesisPsbt.psbtOptions())
        genesisPsbt.combine(ExtPsbt.fromHex(signedGenesisPsbt))
        genesisPsbt.finalizeAllInputs()

        const genesisUtxo = genesisPsbt.getUtxo(0)!
        const tokenId = `${genesisUtxo.txId}_${genesisUtxo.outputIndex}`
        const genesisOutpoint = outpoint2ByteString(tokenId)

        const premineAmount = premineCount * amountPerMint;
        const cat20OpenMinter = new CAT20OpenMinter(
            genesisOutpoint,
            totalMintCount,
            premineAmount,
            premineCount,
            amountPerMint,
            toTokenOwnerAddress(mainAddress)
        )
        const minterScriptHash = ContractPeripheral.scriptHash(cat20OpenMinter)
        const cat20 = new CAT20(minterScriptHash, false, NULL_ADMIN_SCRIPT_HASH)
        const tokenScriptHash = ContractPeripheral.scriptHash(cat20)

        const minterState: CAT20OpenMinterState = {
            tokenScriptHash,
            hasMintedBefore: false,
            remainingCount: totalMintCount - premineCount,
        };
        cat20OpenMinter.state = minterState;

        // Bind Genesis contract to UTXO
        genesis.bindToUtxo(genesisUtxo);

        const deployPsbt = new ExtPsbt({ network: await testProvider.getNetwork(), maximumFeeRate: 1e8 })
            .addContractInput(genesis, genesisCheckDeploy())
            .spendUTXO(genesisPsbt.getChangeUTXO()!)
            .addContractOutput(cat20OpenMinter, Postage.MINTER_POSTAGE)
            .seal()
        const signedDeployPsbt = await mainSigner.signPsbt(deployPsbt.toHex(), deployPsbt.psbtOptions())
        deployPsbt.combine(ExtPsbt.fromHex(signedDeployPsbt))
        deployPsbt.finalizeAllInputs()

        return {
            minter: cat20OpenMinter,
            backtrace: {
                prevTxHex: deployPsbt.extractTransaction().toHex(),
                prevTxInput: 0,
                prevPrevTxHex: genesisPsbt.extractTransaction().toHex(),
            }
        }
    }

    async function mint(
        minterInfo: MinterInfo,
        mintAmount: CAT20_AMOUNT,
        unlockCall: (contract: CAT20OpenMinter, curPsbt: IExtPsbt) => void,
        addMinterOutput: boolean = true,
    ) {

        const { minter, backtrace } = minterInfo;

        const nextMinterState = {
            ...minter.state,
        }
        const isPremine = minter.premine > 0n && !minter.state.hasMintedBefore;
        if (!isPremine) {
            nextMinterState.remainingCount = minter.state.remainingCount - 1n;
        }
        nextMinterState.hasMintedBefore = true;

        const nextMinter = minter.next(nextMinterState);

        const cat20 = new CAT20(ContractPeripheral.scriptHash(nextMinter), false, NULL_ADMIN_SCRIPT_HASH);
        cat20.state = {
            ownerAddr: toTokenOwnerAddress(mainAddress),
            amount: mintAmount,
        }

        const mintPsbt = new ExtPsbt({ network: await testProvider.getNetwork(), maximumFeeRate: 1e8 })
            .addContractInput(minter, (contract, curPsbt) => {
                unlockCall(contract, curPsbt);
            })
            .spendUTXO(getDummyUtxo(mainAddress, 1e8))

        if (addMinterOutput) {
            mintPsbt.addContractOutput(nextMinter, Postage.MINTER_POSTAGE)
        }

        mintPsbt.addContractOutput(cat20, Postage.TOKEN_POSTAGE)
            .seal()
        {
            const signedMintPsbt = await mainSigner.signPsbt(mintPsbt.toHex(), mintPsbt.psbtOptions())
            mintPsbt.combine(ExtPsbt.fromHex(signedMintPsbt))
        }
        {
            const signedMintPsbt = await signer2.signPsbt(mintPsbt.toHex(), mintPsbt.psbtOptions())
            mintPsbt.combine(ExtPsbt.fromHex(signedMintPsbt))
        }
        mintPsbt.finalizeAllInputs()

        return {
            minter: nextMinter,
            backtrace: {
                prevTxHex: mintPsbt.extractTransaction().toHex(),
                prevTxInput: 0,
                prevPrevTxHex: backtrace.prevTxHex,
            }
        }
    }
})