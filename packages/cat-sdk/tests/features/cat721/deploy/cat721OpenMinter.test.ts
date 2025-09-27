import { bvmVerify, ExtPsbt, intToByteString, sha256, UTXO } from "@opcat-labs/scrypt-ts-opcat"
import { CAT721MerkleLeaf, CAT721OpenMinter, CAT721OpenMinterMetadata, ConstantsLib, HEIGHT, MerkleProof, OpenMinterCAT721Meta, ProofNodePos } from "../../../../src/contracts"
import { CAT721OpenMinterMerkleTreeData } from "../../../../src/lib/cat721OPenMinterMerkleTreeData"
import { loadAllArtifacts, mintNft } from "../utils"
import { testSigner } from "../../../utils/testSigner"
import { MetadataSerializer } from "../../../../src/lib/metadata"
import { deployNft } from '../../../../src/features/cat721/deploy/cat721OpenMinter'
import { mintNft as mint } from '../../../../src/features/cat721/mint/cat721OpenMinter'
import { testProvider } from "../../../utils/testProvider"
import { verifyTx } from "../../../utils"
import { toTokenOwnerAddress } from "../../../../src/utils"
import { CAT721OpenMinterMerkleTree } from "../../../../src/contracts/cat721/minters/cat721OpenMinterMerkleTree"
import { expect, use } from "chai"
import chaiAsPromised from "chai-as-promised"


use(chaiAsPromised)


describe('Test the feature `deploy` for `CAT721OpenMinter`', () => {

    const collectionMax = 100n
    let metadata: OpenMinterCAT721Meta
    let nftOpenMinterMerkleTreeData: CAT721OpenMinterMerkleTreeData
    let minterUtxo: UTXO
    
    let genesisTx: ExtPsbt
    let deployTx: ExtPsbt
    let collectionId: string
    let address: string;

    before(async () => {
        loadAllArtifacts()
        address = await testSigner.getAddress()
        metadata = {
            tag: ConstantsLib.OPCAT_CAT721_METADATA_TAG,
            name: 'c',
            symbol: 'C',
            description: 'c',
            max: 100n,
            premine: 10n,
            preminerAddr: toTokenOwnerAddress(address),
            icon: 'c',
            minterMd5: 'c',
        }
        nftOpenMinterMerkleTreeData = new CAT721OpenMinterMerkleTreeData(generateCollectionLeaf(collectionMax), HEIGHT)
        const dpeloyResult = await deployNft(
            testSigner,
            testProvider,
            metadata,
            nftOpenMinterMerkleTreeData.merkleRoot,
            await testProvider.getFeeRate()
        )
        genesisTx = dpeloyResult.genesisPsbt
        deployTx = dpeloyResult.deployPsbt
        collectionId = dpeloyResult.collectionId
        minterUtxo = deployTx.getUtxo(0)
    })

    describe('should deploy successfully', () => {
        it('should deploy successfully', async () => {
            verifyTx(genesisTx, expect)
            verifyTx(deployTx, expect)
        })

        it('should mint the nft if applicable', async () => {
            for (let i = 0; i < 20; i++) {
                const minterState = CAT721OpenMinter.deserializeState(minterUtxo.data)
                const index = Number(minterState.nextLocalId)
                const oldLeaf = nftOpenMinterMerkleTreeData.getLeaf(index)
                console.log('old, leaf: ', oldLeaf, ' root: ', nftOpenMinterMerkleTreeData.merkleRoot, ' leaf hash: ', CAT721OpenMinterMerkleTree.leafStateHash(oldLeaf))
                const newLeaf: CAT721MerkleLeaf = {
                    ...oldLeaf,
                    isMined: true,
                }
                console.log('new leaf: ', newLeaf, ' leaf hash: ', CAT721OpenMinterMerkleTree.leafStateHash(newLeaf))
                const updateLeafInfo = nftOpenMinterMerkleTreeData.updateLeaf(newLeaf, index)
                const nftStorage = getNftStorage(BigInt(index))
                console.log('index', index)
                
                const mintResult = await mint(
                    testSigner,
                    testProvider,
                    minterUtxo,
                    updateLeafInfo.neighbor as MerkleProof,
                    updateLeafInfo.neighborType as ProofNodePos,
                    updateLeafInfo.merkleRoot,
                    nftStorage,
                    collectionId,
                    metadata,
                    toTokenOwnerAddress(address),
                    address,
                    await testProvider.getFeeRate()
                )
                verifyTx(mintResult.mintPsbt, expect)
                minterUtxo = mintResult.mintPsbt.getUtxo(0)
            }
        })
    })
})


function getNftStorage(localId: bigint) {
    return {
        contentType: 'image/png',
        contentBody: 'c',
        nftmetadata: {
            localId: localId,
        },
    }
}

function generateCollectionLeaf(max: bigint) {
    const nftMerkleLeafList: CAT721MerkleLeaf[] = []
    for (let i = 0n; i < max; i++) {
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
        if (i <= 1n) {
            console.log(`nftStr: ${i} `, nftStr, 'hash: ', sha256(nftStr))
        }

        nftMerkleLeafList.push({
            contentDataHash: sha256(nftStr),
            localId: i,
            isMined: false,
        })
    }
    return nftMerkleLeafList
}