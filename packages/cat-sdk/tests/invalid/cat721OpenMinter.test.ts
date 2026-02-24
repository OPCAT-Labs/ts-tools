import { CAT20ClosedMinter, CAT20, CAT20ClosedMinterState, ConstantsLib, CAT20_AMOUNT, CAT721OpenMinter, CAT721, CAT721OpenMinterState, CAT721MerkleLeaf, HEIGHT, MerkleProof, ProofNodePos } from "../../src/contracts";
import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { isLocalTest } from '../utils';
import { testProvider } from '../utils/testProvider';
import { loadAllArtifacts } from '../features/cat721/utils';
import { Address, assert, cloneDeep, DefaultSigner, ExtPsbt, fill, getBackTraceInfo, IExtPsbt, PubKey, sha256, Sig, Signer, toByteString, toHex, uint8ArrayToHex, UTXO, Genesis, genesisCheckDeploy } from '@opcat-labs/scrypt-ts-opcat';
import { testSigner } from '../utils/testSigner';
import { getDummyUtxo, outpoint2ByteString, toTokenOwnerAddress } from "../../src/utils";
import { ContractPeripheral, CAT721GuardPeripheral } from "../../src/utils/contractPeripheral";
import { Postage } from "../../src/typeConstants";
import { CAT721OpenMinterMerkleTreeData } from "../../src/lib/cat721OPenMinterMerkleTreeData";
import { MetadataSerializer } from "../../src/lib/metadata";
import { createNft } from "../../src/features/cat721/mint/nft";
import { CAT721OpenMintInfo, CAT721OpenMintInfoState } from "../../src/contracts/cat721/minters/cat721OpenMintInfo";

use(chaiAsPromised)

type MinterInfo = {
    minter: CAT721OpenMinter,
    backtrace: {
        prevTxHex: string,
        prevTxInput: number,
        prevPrevTxHex: string,
    },
    merkleTree: CAT721OpenMinterMerkleTreeData
}
const defaultMintConfig = {
    addMinterOutput: true,
    addContentInput: true,
    addMintInfoInput: true,
    addDummyContentInput: false,
    addDummyMintInfoInput: false,
}
isLocalTest(testProvider) && describe('Test invalid mint for cat721OpenMinter', () => {
    let mainAddress: string;
    let mainPubKey: PubKey
    let mainSigner: Signer = testSigner;
    let signer2: Signer = new DefaultSigner()
    let signer2PubKey: PubKey;
    let signer2Address: string;

    before(async () => {
        loadAllArtifacts();
        mainAddress = await testSigner.getAddress();
        mainPubKey = PubKey(await testSigner.getPublicKey());
        signer2PubKey = PubKey(await signer2.getPublicKey());
        signer2Address = await signer2.getAddress();
    });

    describe('should succeed when all is set correctly', () => {
        let minter: MinterInfo;
        before(async () => {
            minter = await createMinter(100n, 2n, 0n);
        });

        it('should premine successfully when all is set correctly', async () => {
            minter = await mint(minter, 0n, (contract, curPsbt, mintInfo: CAT721OpenMintInfoState) => {
                const cat721State = {
                    localId: 0n,
                    ownerAddr: toTokenOwnerAddress(mainAddress),
                }
                const updateInfo = getUpdateLeafInfo(minter.merkleTree, mintInfo.localId);

                contract.mint(
                    cat721State,
                    mintInfo,
                    updateInfo.neighbor as MerkleProof,
                    updateInfo.neighborType as ProofNodePos,
                    PubKey(mainPubKey),
                    curPsbt.getSig(0, { address: mainAddress }),
                    BigInt(Postage.MINTER_POSTAGE),
                    BigInt(Postage.NFT_POSTAGE),
                    getBackTraceInfo(minter.backtrace.prevTxHex, minter.backtrace.prevPrevTxHex, minter.backtrace.prevTxInput),
                )
            })
            minter = await mint(minter, 1n, (contract, curPsbt, mintInfo: CAT721OpenMintInfoState) => {
                const cat721State = {
                    localId: 1n,
                    ownerAddr: toTokenOwnerAddress(mainAddress),
                }
                const updateInfo = getUpdateLeafInfo(minter.merkleTree, mintInfo.localId);

                contract.mint(
                    cat721State,
                    mintInfo,
                    updateInfo.neighbor as MerkleProof,
                    updateInfo.neighborType as ProofNodePos,
                    PubKey(mainPubKey),
                    curPsbt.getSig(0, { address: mainAddress }),
                    BigInt(Postage.MINTER_POSTAGE),
                    BigInt(Postage.NFT_POSTAGE),
                    getBackTraceInfo(minter.backtrace.prevTxHex, minter.backtrace.prevPrevTxHex, minter.backtrace.prevTxInput),
                )
            })
        })
        it('should mint successfully when all is set correctly', async () => {
            minter = await mint(minter, 2n, (contract, curPsbt, mintInfo: CAT721OpenMintInfoState) => {
                const cat721State = {
                    localId: 2n,
                    ownerAddr: toTokenOwnerAddress(mainAddress),
                }
                const updateInfo = getUpdateLeafInfo(minter.merkleTree, mintInfo.localId);

                contract.mint(
                    cat721State,
                    mintInfo,
                    updateInfo.neighbor as MerkleProof,
                    updateInfo.neighborType as ProofNodePos,
                    '' as PubKey,
                    '' as Sig,
                    BigInt(Postage.MINTER_POSTAGE),
                    BigInt(Postage.NFT_POSTAGE),
                    getBackTraceInfo(minter.backtrace.prevTxHex, minter.backtrace.prevPrevTxHex, minter.backtrace.prevTxInput),
                )
            })
        })
    })
    it('should premine failed when the preminer sig is invalid', async () => {
        let minter = await createMinter(100n, 2n, 0n);
        try {
            await mint(minter, 0n, (contract, curPsbt, mintInfo: CAT721OpenMintInfoState) => {
                const cat721State = {
                    localId: 0n,
                    ownerAddr: toTokenOwnerAddress(mainAddress),
                }
                const updateInfo = getUpdateLeafInfo(minter.merkleTree, mintInfo.localId);

                contract.mint(
                    cat721State,
                    mintInfo,
                    updateInfo.neighbor as MerkleProof,
                    updateInfo.neighborType as ProofNodePos,
                    PubKey(mainPubKey),
                    curPsbt.getSig(0, { address: signer2Address }),
                    BigInt(Postage.MINTER_POSTAGE),
                    BigInt(Postage.NFT_POSTAGE),
                    getBackTraceInfo(minter.backtrace.prevTxHex, minter.backtrace.prevPrevTxHex, minter.backtrace.prevTxInput),
                )
            })
        } catch (error) {
            expect(error.message.includes('signature check failed')).to.be.true
        }
    })
    it('should premine failed when the preminer pubkey is invalid', async () => {
        let minter = await createMinter(100n, 2n, 0n);
        try {
            await mint(minter, 0n, (contract, curPsbt, mintInfo: CAT721OpenMintInfoState) => {
                const cat721State = {
                    localId: 0n,
                    ownerAddr: toTokenOwnerAddress(mainAddress),
                }
                const updateInfo = getUpdateLeafInfo(minter.merkleTree, mintInfo.localId);

                contract.mint(
                    cat721State,
                    mintInfo,
                    updateInfo.neighbor as MerkleProof,
                    updateInfo.neighborType as ProofNodePos,
                    PubKey(signer2PubKey),
                    curPsbt.getSig(0, { address: signer2Address }),
                    BigInt(Postage.MINTER_POSTAGE),
                    BigInt(Postage.NFT_POSTAGE),
                    getBackTraceInfo(minter.backtrace.prevTxHex, minter.backtrace.prevPrevTxHex, minter.backtrace.prevTxInput),
                )
            })
        } catch (error) {
            expect(error.message.includes('owner address is not match to the pubkey')).to.be.true;
        }
    })
    it('should fail when the localId is wrong', async () => {
        let minter = await createMinter(100n, 2n, 0n);
        try {
            await mint(minter, 0n, (contract, curPsbt, mintInfo: CAT721OpenMintInfoState) => {
                const cat721State = {
                    localId: 0n,
                    ownerAddr: toTokenOwnerAddress(mainAddress),
                }
                const updateInfo = getUpdateLeafInfo(minter.merkleTree, mintInfo.localId);

                contract.mint(
                    cat721State,
                    mintInfo,
                    updateInfo.neighbor as MerkleProof,
                    updateInfo.neighborType as ProofNodePos,
                    PubKey(mainPubKey),
                    curPsbt.getSig(0, { address: mainAddress }),
                    BigInt(Postage.MINTER_POSTAGE),
                    BigInt(Postage.NFT_POSTAGE),
                    getBackTraceInfo(minter.backtrace.prevTxHex, minter.backtrace.prevPrevTxHex, minter.backtrace.prevTxInput),
                )
            })
        } catch (error) {
            expect(error.message.includes('nft local id mismatch')).to.be.true;
        }
    })
    it('should fail when the proof is invalid', async () => {
        let minter = await createMinter(100n, 2n, 0n);
        try {
            await mint(minter, 0n, (contract, curPsbt, mintInfo: CAT721OpenMintInfoState) => {
                const cat721State = {
                    localId: 0n,
                    ownerAddr: toTokenOwnerAddress(mainAddress),
                }
                const updateInfo = getUpdateLeafInfo(minter.merkleTree, mintInfo.localId);

                // make the proof invalid
                updateInfo.neighbor[0] = sha256('01');

                contract.mint(
                    cat721State,
                    mintInfo,
                    updateInfo.neighbor as MerkleProof,
                    updateInfo.neighborType as ProofNodePos,
                    PubKey(mainPubKey),
                    curPsbt.getSig(0, { address: mainAddress }),
                    BigInt(Postage.MINTER_POSTAGE),
                    BigInt(Postage.NFT_POSTAGE),
                    getBackTraceInfo(minter.backtrace.prevTxHex, minter.backtrace.prevPrevTxHex, minter.backtrace.prevTxInput),
                )
            })
        } catch (error) {
            expect(error.message.includes('merkle root mismatch')).to.be.true;
        }
        try {
            await mint(minter, 0n, (contract, curPsbt, mintInfo: CAT721OpenMintInfoState) => {
                const cat721State = {
                    localId: 0n,
                    ownerAddr: toTokenOwnerAddress(mainAddress),
                }
                const updateInfo = getUpdateLeafInfo(minter.merkleTree, mintInfo.localId);

                // make the proof invalid
                updateInfo.neighborType[0] = !updateInfo.neighborType[0];

                contract.mint(
                    cat721State,
                    mintInfo,
                    updateInfo.neighbor as MerkleProof,
                    updateInfo.neighborType as ProofNodePos,
                    PubKey(mainPubKey),
                    curPsbt.getSig(0, { address: mainAddress }),
                    BigInt(Postage.MINTER_POSTAGE),
                    BigInt(Postage.NFT_POSTAGE),
                    getBackTraceInfo(minter.backtrace.prevTxHex, minter.backtrace.prevPrevTxHex, minter.backtrace.prevTxInput),
                )
            })
        } catch (error) {
            expect(error.message.includes('merkle root mismatch')).to.be.true;
        }
    })
    it('should fail when lack nft content input', async () => {
        let minter = await createMinter(100n, 2n, 0n);
        try {
            await mint(
                minter,
                0n,
                (contract, curPsbt, mintInfo: CAT721OpenMintInfoState) => {
                    const cat721State = {
                        localId: 0n,
                        ownerAddr: toTokenOwnerAddress(mainAddress),
                    }
                    const updateInfo = getUpdateLeafInfo(minter.merkleTree, mintInfo.localId);

                    contract.mint(
                        cat721State,
                        mintInfo,
                        updateInfo.neighbor as MerkleProof,
                        updateInfo.neighborType as ProofNodePos,
                        PubKey(mainPubKey),
                        curPsbt.getSig(0, { address: mainAddress }),
                        BigInt(Postage.MINTER_POSTAGE),
                        BigInt(Postage.NFT_POSTAGE),
                        getBackTraceInfo(minter.backtrace.prevTxHex, minter.backtrace.prevPrevTxHex, minter.backtrace.prevTxInput),
                    )
                },
                { ...defaultMintConfig, addContentInput: false, addDummyContentInput: true }
            )
        } catch (error) {
            expect(error.message.includes('input1 state hash mismatch')).to.be.true;
        }
    })
    it('should fail when lack mint info input', async () => {
        let minter = await createMinter(100n, 2n, 0n);
        try {
            await mint(
                minter,
                0n,
                (contract, curPsbt, mintInfo: CAT721OpenMintInfoState) => {
                    const cat721State = {
                        localId: 0n,
                        ownerAddr: toTokenOwnerAddress(mainAddress),
                    }
                    const updateInfo = getUpdateLeafInfo(minter.merkleTree, mintInfo.localId);

                    contract.mint(
                        cat721State,
                        mintInfo,
                        updateInfo.neighbor as MerkleProof,
                        updateInfo.neighborType as ProofNodePos,
                        PubKey(mainPubKey),
                        curPsbt.getSig(0, { address: mainAddress }),
                        BigInt(Postage.MINTER_POSTAGE),
                        BigInt(Postage.NFT_POSTAGE),
                        getBackTraceInfo(minter.backtrace.prevTxHex, minter.backtrace.prevPrevTxHex, minter.backtrace.prevTxInput),
                    )
                },
                { ...defaultMintConfig, addMintInfoInput: false, addDummyMintInfoInput: true }
            )
        } catch (error) {
            expect(error.message.includes('input2 state hash mismatch')).to.be.true;
        }
    })
    describe('should fail when no nft left in the minter', async () => {
        let minter: MinterInfo;
        before(async () => {
            minter = await createMinter(2n, 1n, 0n);
            minter = await mint(minter, 0n, (contract, curPsbt, mintInfo: CAT721OpenMintInfoState) => {
                const cat721State = {
                    localId: 0n,
                    ownerAddr: toTokenOwnerAddress(mainAddress),
                }
                const updateInfo = getUpdateLeafInfo(minter.merkleTree, mintInfo.localId);

                contract.mint(
                    cat721State,
                    mintInfo,
                    updateInfo.neighbor as MerkleProof,
                    updateInfo.neighborType as ProofNodePos,
                    PubKey(mainPubKey),
                    curPsbt.getSig(0, { address: mainAddress }),
                    BigInt(Postage.MINTER_POSTAGE),
                    BigInt(Postage.NFT_POSTAGE),
                    getBackTraceInfo(minter.backtrace.prevTxHex, minter.backtrace.prevPrevTxHex, minter.backtrace.prevTxInput),
                )
            })
        })
        it('should succeed when mint the last nft and do not add minter output', async () => {
            await mint(
                minter,
                1n,
                (contract, curPsbt, mintInfo: CAT721OpenMintInfoState) => {
                    const cat721State = {
                        localId: 1n,
                        ownerAddr: toTokenOwnerAddress(mainAddress),
                    }
                    const updateInfo = getUpdateLeafInfo(minter.merkleTree, mintInfo.localId);

                    contract.mint(
                        cat721State,
                        mintInfo,
                        updateInfo.neighbor as MerkleProof,
                        updateInfo.neighborType as ProofNodePos,
                        '' as PubKey,
                        '' as Sig,
                        BigInt(Postage.MINTER_POSTAGE),
                        BigInt(Postage.NFT_POSTAGE),
                        getBackTraceInfo(minter.backtrace.prevTxHex, minter.backtrace.prevPrevTxHex, minter.backtrace.prevTxInput),
                    )
                },
                { ...defaultMintConfig, addMinterOutput: false }
            )
        })
        it('should fail when mint the last nft and add minter output', async () => {
            try {
                await mint(
                    minter,
                    1n,
                    (contract, curPsbt, mintInfo: CAT721OpenMintInfoState) => {
                        const cat721State = {
                            localId: 1n,
                            ownerAddr: toTokenOwnerAddress(mainAddress),
                        }
                        const updateInfo = getUpdateLeafInfo(minter.merkleTree, mintInfo.localId);

                        contract.mint(
                            cat721State,
                            mintInfo,
                            updateInfo.neighbor as MerkleProof,
                            updateInfo.neighborType as ProofNodePos,
                            '' as PubKey,
                            '' as Sig,
                            BigInt(Postage.MINTER_POSTAGE),
                            BigInt(Postage.NFT_POSTAGE),
                            getBackTraceInfo(minter.backtrace.prevTxHex, minter.backtrace.prevPrevTxHex, minter.backtrace.prevTxInput),
                        )
                    },
                    { ...defaultMintConfig, addMinterOutput: true }
                )
            } catch (error) {
                expect(error.message.includes('Outputs mismatch with the transaction context')).to.be.true;
            }
        })
    })

    async function createMinter(
        max: bigint,
        premine: bigint,
        nextLocalId: bigint,
    ): Promise<MinterInfo> {
        max = nextLocalId + max;
        premine = nextLocalId + premine;
        assert(max >= premine)

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
        const collectionId = `${genesisUtxo.txId}_${genesisUtxo.outputIndex}`
        const genesisOutpoint = outpoint2ByteString(collectionId)

        const cat721OpenMinter = new CAT721OpenMinter(genesisOutpoint, max, premine, toTokenOwnerAddress(mainAddress));
        const minterScriptHash = ContractPeripheral.scriptHash(cat721OpenMinter);
        const cat721 = new CAT721(minterScriptHash);
        const nftScriptHash = ContractPeripheral.scriptHash(cat721);
        const merkleTree = new CAT721OpenMinterMerkleTreeData(generateCollectionLeaf(nextLocalId, max), HEIGHT);
        const minterState: CAT721OpenMinterState = {
            nftScriptHash,
            merkleRoot: merkleTree.merkleRoot,
            nextLocalId: nextLocalId,
        }
        cat721OpenMinter.state = minterState;

        // Bind Genesis contract to UTXO
        genesis.bindToUtxo(genesisUtxo);

        const deployPsbt = new ExtPsbt({ network: await testProvider.getNetwork(), maximumFeeRate: 1e8 })
            .addContractInput(genesis, genesisCheckDeploy())
            .spendUTXO(genesisPsbt.getChangeUTXO()!)
            .addContractOutput(cat721OpenMinter, Postage.MINTER_POSTAGE)
            .seal()
        const signedDeployPsbt = await mainSigner.signPsbt(deployPsbt.toHex(), deployPsbt.psbtOptions())
        deployPsbt.combine(ExtPsbt.fromHex(signedDeployPsbt))
        deployPsbt.finalizeAllInputs()

        return {
            minter: cat721OpenMinter,
            backtrace: {
                prevTxHex: deployPsbt.extractTransaction().toHex(),
                prevTxInput: 0,
                prevPrevTxHex: genesisPsbt.extractTransaction().toHex(),
            },
            merkleTree: merkleTree,
        }
    }

    async function mint(
        minterInfo: MinterInfo,
        mintLocalId: bigint,
        unlockCall: (contract: CAT721OpenMinter, curPsbt: IExtPsbt, mintInfo: CAT721OpenMintInfoState) => void,
        config: {
            addMinterOutput: boolean,
            addContentInput: boolean,
            addMintInfoInput: boolean,
            addDummyContentInput: boolean,
            addDummyMintInfoInput: boolean,
        } = defaultMintConfig
    ): Promise<MinterInfo> {
        let contentUtxo: UTXO;
        let mintInfoUtxo: UTXO;
        if (true) {
            // deploy nft metadata,content
            const createNftRes = await createNft(
                testSigner,
                testProvider,
                mintLocalId,
                getNftStorage(mintLocalId),
                [getDummyUtxo(mainAddress, 1e5)],
                await testProvider.getFeeRate()
            )
            contentUtxo = createNftRes.contentUtxo;
            mintInfoUtxo = createNftRes.mintInfoUtxo
        }

        const { minter, backtrace, merkleTree } = minterInfo;
        const clonedMerkleTree = cloneDeep(merkleTree);
        const updateInfo = getUpdateLeafInfo(clonedMerkleTree, mintLocalId);
        const nextMinterState = {
            ...minter.state,
            nextLocalId: minter.state.nextLocalId + 1n,
            merkleRoot: updateInfo.merkleRoot,
        }

        const nextMinter = minter.next(nextMinterState);
        const cat721 = new CAT721(ContractPeripheral.scriptHash(nextMinter));
        cat721.state = {
            localId: mintLocalId,
            ownerAddr: toTokenOwnerAddress(mainAddress),
        }
        const mintPsbt = new ExtPsbt({ network: await testProvider.getNetwork(), maximumFeeRate: 1e8 })
            .addContractInput(minter, (contract, tx) => {
                const mintInfo = CAT721OpenMintInfo.deserializeState(mintInfoUtxo.data)
                unlockCall(contract, tx, mintInfo);
            })
        if (config.addContentInput) {
            mintPsbt.spendUTXO(contentUtxo);
        }
        if (config.addDummyContentInput) {
            mintPsbt.spendUTXO(getDummyUtxo(mainAddress, 1));
        }
        if (config.addMintInfoInput) {
            mintPsbt.spendUTXO(mintInfoUtxo);
        }
        if (config.addDummyMintInfoInput) {
            mintPsbt.spendUTXO(getDummyUtxo(mainAddress, 1));
        }
        if (config.addMinterOutput) {
            mintPsbt.addContractOutput(nextMinter, Postage.MINTER_POSTAGE);
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
            },
            merkleTree: clonedMerkleTree,
        }
    }

    function getUpdateLeafInfo(merkleTree: CAT721OpenMinterMerkleTreeData, mintLocalId: bigint) {
        const oldLeaf = merkleTree.getLeaf(Number(mintLocalId));
        const newLeaf = {
            ...oldLeaf,
            isMined: true,
        }
        return merkleTree.updateLeaf(newLeaf, Number(mintLocalId));
    }

    function generateCollectionLeaf(startLocalId: bigint, max: bigint) {
        const nftMerkleLeafList: CAT721MerkleLeaf[] = []
        for (let i = startLocalId; i < max; i++) {
            const nft = getNftStorage(BigInt(i))
            const nftStr = MetadataSerializer.serialize(
                'NFT',
                {
                    metadata: nft.nftmetadata,
                    content: {
                        type: nft.contentType,
                        body: nft.contentBody,
                    }
                }
            )

            nftMerkleLeafList.push({
                contentDataHash: sha256(nftStr),
                localId: i,
                isMined: false,
            })
        }
        return nftMerkleLeafList
    }

    function getNftStorage(localId: bigint) {
        return {
            contentType: 'image/png',
            contentBody: '89504e470d0a1a0a0000000d4948445200000018000000180806000000e0773df800000006624b474400ff00ff00ffa0bda793000001d6494441544889ad94bf6b1b3114c73f3649a8e376e8209ac183a1dcd10e01a71842bde542a125ff4397820306b7140af91b028536183c648b0964ede2c9d8d93c04070cf5e4c3533b046e28a55308a93b5c257477d2f907fe2e929e9ebedff724bd97797fed4f59111a6557cdeb833100d934a7652089251202cba25176a90fc66a94c8e85714df5c0532696fb0c875d9025b4b23771c676e015bf6c63758941cc0711c63c6890ce24eaf2fda09bb8c54daf460a44dfa44041a65974aa542100408210882401d78fbf915000f363794adda3c00e0f2cb182104004208fafdbe3d833824b124d78925f63eba8cce7f19cfcf5d0792dc063d6a1da919bc3c2cd2fad49937067cdfc7f7fdc86f8a08c84a94e4127f3f34c3c9f3f09eefb61e03307db409c0fdc31c001b4f04ebc5427a06ba481afe1cbd53f35ceb9bd56fe61b549b07644f6ac6bddff91c9d9b1f6abd5e2c248acd5807facf5122b5a8c8e4c533ae2621597e77c71ae0cc6faa8be83806e069b8f7df765a6b2f2ff066743bd3e7d4603376d3f835cdaa0108a337353b6b06f2ffc7dfc3440c0bb4eb46d9a5542a25846cf03c4f9d5b288338c176b7c0f7fd9fca1e5f7b9e67144974533dfa38b6bb05eb9e0dd6421b0e8709db57ce222340af19d74b15f8075976a18372a11c780000000049454e44ae426082',
            nftmetadata: {
                localId: localId,
            },
        }
    }
})