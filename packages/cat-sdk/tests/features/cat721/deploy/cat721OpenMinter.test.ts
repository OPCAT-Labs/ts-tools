import { bvmVerify, ExtPsbt, intToByteString, sha256, UTXO } from "@opcat-labs/scrypt-ts-opcat"
import { CAT721MerkleLeaf, CAT721OpenMinter, CAT721OpenMinterMetadata, ConstantsLib, HEIGHT, MerkleProof, OpenMinterCAT721Meta, ProofNodePos } from "../../../../src/contracts"
import { CAT721OpenMinterMerkleTreeData } from "../../../../src/lib/cat721OPenMinterMerkleTreeData"
import { loadAllArtifacts, mintNft } from "../utils"
import { testSigner } from "../../../utils/testSigner"
import { MetadataSerializer } from "../../../../src/lib/metadata"
import { deployOpenMinterCollection } from '../../../../src/features/cat721/deploy/cat721OpenMinter'
import { mintOpenMinterNft } from '../../../../src/features/cat721/mint/cat721OpenMinter'
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
        const dpeloyResult = await deployOpenMinterCollection(
            testSigner,
            testProvider,
            { metadata },
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
                const newLeaf: CAT721MerkleLeaf = {
                    ...oldLeaf,
                    isMined: true,
                }
                const updateLeafInfo = nftOpenMinterMerkleTreeData.updateLeaf(newLeaf, index)
                const nftStorage = getNftStorage(BigInt(index))
                
                const mintResult = await mintOpenMinterNft(
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
        contentBody: '89504e470d0a1a0a0000000d4948445200000018000000180806000000e0773df800000006624b474400ff00ff00ffa0bda793000001d6494441544889ad94bf6b1b3114c73f3649a8e376e8209ac183a1dcd10e01a71842bde542a125ff4397820306b7140af91b028536183c648b0964ede2c9d8d93c04070cf5e4c3533b046e28a55308a93b5c257477d2f907fe2e929e9ebedff724bd97797fed4f59111a6557cdeb833100d934a7652089251202cba25176a90fc66a94c8e85714df5c0532696fb0c875d9025b4b23771c676e015bf6c63758941cc0711c63c6890ce24eaf2fda09bb8c54daf460a44dfa44041a65974aa542100408210882401d78fbf915000f363794adda3c00e0f2cb182104004208fafdbe3d833824b124d78925f63eba8cce7f19cfcf5d0792dc063d6a1da919bc3c2cd2fad49937067cdfc7f7fdc86f8a08c84a94e4127f3f34c3c9f3f09eefb61e03307db409c0fdc31c001b4f04ebc5427a06ba481afe1cbd53f35ceb9bd56fe61b549b07644f6ac6bddff91c9d9b1f6abd5e2c248acd5807facf5122b5a8c8e4c533ae2621597e77c71ae0cc6faa8be83806e069b8f7df765a6b2f2ff066743bd3e7d4603376d3f835cdaa0108a337353b6b06f2ffc7dfc3440c0bb4eb46d9a5542a25846cf03c4f9d5b288338c176b7c0f7fd9fca1e5f7b9e67144974533dfa38b6bb05eb9e0dd6421b0e8709db57ce222340af19d74b15f8075976a18372a11c780000000049454e44ae426082',
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

        nftMerkleLeafList.push({
            contentDataHash: sha256(nftStr),
            localId: i,
            isMined: false,
        })
    }
    return nftMerkleLeafList
}