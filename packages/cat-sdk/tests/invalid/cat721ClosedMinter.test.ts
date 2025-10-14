import { CAT20ClosedMinter, CAT20, CAT20Guard, CAT20ClosedMinterState, ConstantsLib, CAT20_AMOUNT, CAT721ClosedMinter, CAT721, CAT721Guard, CAT721ClosedMinterState } from "../../src/contracts";
import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { isLocalTest } from '../utils';
import { testProvider } from '../utils/testProvider';
import { loadAllArtifacts } from '../features/cat721/utils';
import { assert, DefaultSigner, ExtPsbt, fill, getBackTraceInfo, IExtPsbt, PubKey, sha256, Signer, toByteString, toHex, uint8ArrayToHex, UTXO } from '@opcat-labs/scrypt-ts-opcat';
import { testSigner } from '../utils/testSigner';
import { getDummyUtxo, outpoint2ByteString, toTokenOwnerAddress } from "../../src/utils";
import { ContractPeripheral } from "../../src/utils/contractPeripheral";
import { Postage } from "../../src/typeConstants";


use(chaiAsPromised)

type MinterInfo = {
    minter: CAT721ClosedMinter,
    backtrace: {
        prevTxHex: string,
        prevTxInput: number,
        prevPrevTxHex: string,
    }
}

isLocalTest(testProvider) && describe('Test invalid mint for cat721ClosedMinter', () => {

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

    it('should succeed when all is set correctly', async () => {
        let minter: MinterInfo = await createMinter(100n, 0n);
        minter = await mint(minter, 0n, (contract, curPsbt) => {
            contract.mint(
                {
                    tag: ConstantsLib.OPCAT_CAT721_TAG,
                    localId: 0n,
                    ownerAddr: toTokenOwnerAddress(mainAddress),
                },
                PubKey(mainPubKey),
                curPsbt.getSig(0, { address: mainAddress }),
                BigInt(Postage.MINTER_POSTAGE),
                BigInt(Postage.NFT_POSTAGE),
                getBackTraceInfo(minter.backtrace.prevTxHex, minter.backtrace.prevPrevTxHex, minter.backtrace.prevTxInput)
            )
        });
        minter = await mint(minter, 1n, (contract, curPsbt) => {
            contract.mint(
                {
                    tag: ConstantsLib.OPCAT_CAT721_TAG,
                    localId: 1n,
                    ownerAddr: toTokenOwnerAddress(mainAddress),
                },
                PubKey(mainPubKey),
                curPsbt.getSig(0, { address: mainAddress }),
                BigInt(Postage.MINTER_POSTAGE),
                BigInt(Postage.NFT_POSTAGE),
                getBackTraceInfo(minter.backtrace.prevTxHex, minter.backtrace.prevPrevTxHex, minter.backtrace.prevTxInput)
            )
        });
    });

    it('should fail when the issuer sig is invalid', async () => {
    });

    it('should fail when the issuer pubkey is invalid', async () => {
    });

    describe('should fail when localId is not same as nextLocalId', () => {
        let minter: MinterInfo;
        before(async () => {
            minter = await createMinter(100n, 10n);
        });

        it('failed on localId < nextLocalId', async () => {
            try {
                await mint(minter, 9n, (contract, curPsbt) => {
                    contract.mint(
                        {
                            tag: ConstantsLib.OPCAT_CAT721_TAG,
                            localId: 9n,
                            ownerAddr: toTokenOwnerAddress(mainAddress),
                        },
                        PubKey(mainPubKey),
                        curPsbt.getSig(0, { address: mainAddress }),
                        BigInt(Postage.MINTER_POSTAGE),
                        BigInt(Postage.NFT_POSTAGE),
                        getBackTraceInfo(minter.backtrace.prevTxHex, minter.backtrace.prevPrevTxHex, minter.backtrace.prevTxInput)
                    )
                });
            } catch (error) {
                expect(error.message).to.equal('Execution failed, nft localId is invalid');
            }
        });

        it('failed on localId > nextLocalId', async () => {
            try {
                await mint(minter, 11n, (contract, curPsbt) => {
                    contract.mint(
                        {
                            tag: ConstantsLib.OPCAT_CAT721_TAG,
                            localId: 11n,
                            ownerAddr: toTokenOwnerAddress(mainAddress),
                        },
                        PubKey(mainPubKey),
                        curPsbt.getSig(0, { address: mainAddress }),
                        BigInt(Postage.MINTER_POSTAGE),
                        BigInt(Postage.NFT_POSTAGE),
                        getBackTraceInfo(minter.backtrace.prevTxHex, minter.backtrace.prevPrevTxHex, minter.backtrace.prevTxInput)
                    )
                });
            } catch (error) {
                expect(error.message).to.equal('Execution failed, nft localId is invalid');
            }
        });
    })

    it('should fail when localId < 0', async () => {
        let minter: MinterInfo = await createMinter(100n, -10n);
        try {
            await mint(minter, -10n, (contract, curPsbt) => {
                contract.mint(
                    {
                        tag: ConstantsLib.OPCAT_CAT721_TAG,
                        localId: -10n,
                        ownerAddr: toTokenOwnerAddress(mainAddress),
                    },
                    PubKey(mainPubKey),
                    curPsbt.getSig(0, { address: mainAddress }),
                    BigInt(Postage.MINTER_POSTAGE),
                    BigInt(Postage.NFT_POSTAGE),
                    getBackTraceInfo(minter.backtrace.prevTxHex, minter.backtrace.prevPrevTxHex, minter.backtrace.prevTxInput)
                )
            });
        } catch (error) {
            expect(error.message).to.equal('Execution failed, nftRemaining is invalid');
        }
    })

    describe('should fail when no nft left in the minter', async () => {

        let minter: MinterInfo;

        const mintNft = async (localId: bigint, addMinterOutput: boolean, updateMinter: boolean = true) => {
            const nextMinter = await mint(minter, localId, (contract, curPsbt) => {
                contract.mint(
                    {
                        tag: ConstantsLib.OPCAT_CAT721_TAG,
                        localId: localId,
                        ownerAddr: toTokenOwnerAddress(mainAddress),
                    },
                    PubKey(mainPubKey),
                    curPsbt.getSig(0, { address: mainAddress }),
                    BigInt(Postage.MINTER_POSTAGE),
                    BigInt(Postage.NFT_POSTAGE),
                    getBackTraceInfo(minter.backtrace.prevTxHex, minter.backtrace.prevPrevTxHex, minter.backtrace.prevTxInput)
                )
            }, addMinterOutput);
            if (updateMinter) {
                minter = nextMinter;
            }
        }
        before(async () => {
            minter = await createMinter(3n, 0n);
            await mintNft(0n, true, true);
            await mintNft(1n, true, true);
        });

        it('should succeed when mint the last nft and do not add minter output', async () => {
            await mintNft(2n, false, false);
        });

        it('should fail when mint the last nft and add minter output', async () => {
            try {
                await mintNft(2n, true, false);
            } catch (error) {
                expect(error.message).to.equal('Execution failed, Outputs mismatch with the transaction context');
            }
        });
    })

    async function createMinter(
        maxLocalId: bigint,
        nextLocalId: bigint,
    ): Promise<MinterInfo> {
        const genesisPsbt = new ExtPsbt({ network: await testProvider.getNetwork() })
            .spendUTXO(getDummyUtxo(mainAddress, 1e8))
            // do not deploy metadata in test
            .change(mainAddress, 1)
            .seal()

        const signedGenesisPsbt = await mainSigner.signPsbt(genesisPsbt.toHex(), genesisPsbt.psbtOptions())
        genesisPsbt.combine(ExtPsbt.fromHex(signedGenesisPsbt))
        genesisPsbt.finalizeAllInputs()

        const genesisUtxo = genesisPsbt.getUtxo(0)
        const collectionId = `${genesisUtxo.txId}_${genesisUtxo.outputIndex}`
        const genesisOutpoint = outpoint2ByteString(collectionId)
        const cat721ClosedMinter = new CAT721ClosedMinter(toTokenOwnerAddress(mainAddress), genesisOutpoint, 100n)
        const minterScriptHash = ContractPeripheral.scriptHash(cat721ClosedMinter)
        const cat721 = new CAT721(
            minterScriptHash,
            ContractPeripheral.scriptHash(new CAT721Guard())
        )
        const nftScriptHash = ContractPeripheral.scriptHash(cat721)
        const minterState: CAT721ClosedMinterState = {
            tag: ConstantsLib.OPCAT_CAT721_MINTER_TAG,
            nftScriptHash,
            maxLocalId,
            nextLocalId,
        }
        cat721ClosedMinter.state = minterState;

        const deployPsbt = new ExtPsbt({ network: await testProvider.getNetwork(), maximumFeeRate: 1e8 })
            .spendUTXO(genesisUtxo)
            .addContractOutput(cat721ClosedMinter, Postage.MINTER_POSTAGE)
            .seal()
        const signedDeployPsbt = await mainSigner.signPsbt(deployPsbt.toHex(), deployPsbt.psbtOptions())
        deployPsbt.combine(ExtPsbt.fromHex(signedDeployPsbt))
        deployPsbt.finalizeAllInputs()

        return {
            minter: cat721ClosedMinter, backtrace: {
                prevTxHex: deployPsbt.extractTransaction().toHex(),
                prevTxInput: 0,
                prevPrevTxHex: genesisPsbt.extractTransaction().toHex(),
            }
        }
    }

    async function mint(
        minterInfo: MinterInfo,
        mintLocalId: bigint,
        unlockCall: (contract: CAT721ClosedMinter, curPsbt: IExtPsbt) => void,
        addMinterOutput: boolean = true,
    ) {
        const { minter, backtrace } = minterInfo;
        const nextMinterState = {
            ...minter.state,
            nextLocalId: minter.state.nextLocalId + 1n,
        }
        const nextMinter = minter.next(nextMinterState);
        const cat721 = new CAT721(ContractPeripheral.scriptHash(nextMinter), ContractPeripheral.scriptHash(new CAT721Guard()));
        cat721.state = {
            tag: ConstantsLib.OPCAT_CAT721_TAG,
            localId: mintLocalId,
            ownerAddr: toTokenOwnerAddress(mainAddress),
        }

        const mintPsbt = new ExtPsbt({ network: await testProvider.getNetwork(), maximumFeeRate: 1e8 })
            .addContractInput(minter, (contract, curPsbt) => {
                unlockCall(contract, curPsbt);
            })
            .spendUTXO(getDummyUtxo(mainAddress, 1e8))

        if (addMinterOutput) {
            mintPsbt.addContractOutput(nextMinter, Postage.MINTER_POSTAGE)
        }

        mintPsbt.addContractOutput(cat721, Postage.NFT_POSTAGE)
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