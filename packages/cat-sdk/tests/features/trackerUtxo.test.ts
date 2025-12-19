import { expect, use } from 'chai'
import chaiAsPromised from 'chai-as-promised'
import { sha256, UTXO, ExtPsbt } from '@opcat-labs/scrypt-ts-opcat'
import { testSigner } from '../utils/testSigner'
import { loadAllArtifacts as loadCAT20Artifacts, deployToken, mintToken } from './cat20/utils'
import { loadAllArtifacts as loadCAT721Artifacts } from './cat721/utils'
import { ClosedMinterCAT20Meta, OpenMinterCAT20Meta } from '../../src/contracts/cat20/types'
import { OpenMinterCAT721Meta, CAT721MerkleLeaf, MerkleProof, ProofNodePos, HEIGHT } from '../../src/contracts/cat721/types'
import { toTokenOwnerAddress } from '../../src/utils'
import { formatMetadata } from '../../src/lib/metadata'
import { CAT20OpenMinter } from '../../src/contracts/cat20/minters/cat20OpenMinter'
import { CAT20ClosedMinter } from '../../src/contracts/cat20/minters/cat20ClosedMinter'
import { CAT721ClosedMinter } from '../../src/contracts/cat721/minters/cat721ClosedMinter'
import { TestCAT20Generator } from '../utils/testCAT20Generator'
import { TestCAT721Generator } from '../utils/testCAT721Generator'
import { singleSend } from '../../src/features/cat20/send/singleSend'
import { testProvider } from '../utils/testProvider'
import { singleSendNft } from '../../src/features/cat721/send/singleSend'
import { burnToken } from '../../src/features/cat20/burn/burn'
import { burnNft } from '../../src/features/cat721/burn/burn'
import { mintClosedMinterNft } from '../../src/features/cat721/mint/cat721ClosedMinter'
import { deployOpenMinterCollection } from '../../src/features/cat721/deploy/cat721OpenMinter'
import { mintOpenMinterNft } from '../../src/features/cat721/mint/cat721OpenMinter'
import { CAT721OpenMinterMerkleTreeData } from '../../src/lib/cat721OPenMinterMerkleTreeData'
import { CAT721OpenMinter } from '../../src/contracts/cat721/minters/cat721OpenMinter'
import { MetadataSerializer } from '../../src/lib/metadata'
import { isLocalTest, runWithDryCheck } from '../utils'
import { deployClosedMinterToken } from '../../src/features/cat20/deploy/closedMinter'
import { mintClosedMinterToken } from '../../src/features/cat20/mint/closedMinter'

use(chaiAsPromised)

/**
 * Simulates a tracker UTXO by replacing the script field with its sha256 hash.
 * Trackers often return script hashes instead of full scripts to reduce bandwidth.
 * Note: psbt.getUtxo() returns UTXOs with full scripts, so we need to hash them
 * to simulate what a tracker would return.
 */
function toTrackerUtxo(utxo: UTXO): UTXO {
  const u = {
    ...utxo,
    script: sha256(utxo.script),
  }
  delete (u as any).txHashPreimage
  return u
}

isLocalTest(testProvider) && describe('Test tracker UTXO compatibility', () => {
  let address: string
  let tokenReceiverAddr: string

  before(async () => {
    loadCAT20Artifacts()
    loadCAT721Artifacts()
    address = await testSigner.getAddress()
    tokenReceiverAddr = toTokenOwnerAddress(address)
  })

  describe('CAT20 ClosedMinter with tracker UTXOs', () => {
    let metadata: ClosedMinterCAT20Meta;
    before(async () => {
      metadata = formatMetadata({
        name: 'Tracker Test Token',
        symbol: 'TTT',
        decimals: 0n,
        hasAdmin: false,
      })
    })

    it('should mint token with tracker-style minter UTXO', async () => {
      const deployRes = await deployClosedMinterToken(
        testSigner,
        testProvider,
        {metadata},
        await testProvider.getFeeRate()
      )
      const trackerMinterUtxo = toTrackerUtxo(deployRes.deployPsbt.getUtxo(0))
      const mintRes = await mintClosedMinterToken(
        testSigner,
        testProvider,
        trackerMinterUtxo,
        deployRes.metadata.hasAdmin,
        deployRes.adminScriptHash,
        deployRes.tokenId,
        tokenReceiverAddr,
        100n,
        address,
        await testProvider.getFeeRate()
      )
      expect(mintRes.mintTxId).to.be.a('string')
    })
  })

  describe('CAT20 OpenMinter with tracker UTXOs', () => {
    let metadata: OpenMinterCAT20Meta

    before(async () => {
      metadata = formatMetadata({
        name: 'Tracker Test Token',
        symbol: 'TTT',
        decimals: 0n,
        hasAdmin: false,
        max: 21000n,
        limit: 100n,
        premine: 0n,
        preminerAddr: tokenReceiverAddr,
        minterMd5: CAT20OpenMinter.artifact.md5,
      })
    })

    it('should mint token with tracker-style minter UTXO', async () => {
      const { deployPsbt, tokenId } = await deployToken(metadata)
      const originalMinterUtxo = deployPsbt.getUtxo(0)

      // Convert to tracker UTXO (script becomes sha256 hash)
      const trackerMinterUtxo = toTrackerUtxo(originalMinterUtxo)

      // Mint should work with tracker UTXO - this validates normalizeUtxoScripts works
      const result = await mintToken(trackerMinterUtxo, tokenId, metadata)

      expect(result.mintTxid).to.be.a('string')
      expect(result.mintPsbt).to.exist
    })

    it('should handle multiple tracker-style minter UTXOs sequentially', async () => {
      // Deploy twice to get independent minters
      const deploy1 = await deployToken(metadata)
      const deploy2 = await deployToken(metadata)

      // Get minter UTXOs from different deployments
      const minter1 = deploy1.deployPsbt.getUtxo(0)
      const minter2 = deploy2.deployPsbt.getUtxo(0)

      // Convert both to tracker UTXOs
      const trackerMinter1 = toTrackerUtxo(minter1)
      const trackerMinter2 = toTrackerUtxo(minter2)

      // Mint with first tracker UTXO
      const result1 = await mintToken(trackerMinter1, deploy1.tokenId, metadata)
      expect(result1.mintTxid).to.be.a('string')

      // Mint with second tracker UTXO
      const result2 = await mintToken(trackerMinter2, deploy2.tokenId, metadata)
      expect(result2.mintTxid).to.be.a('string')
    })

    it('should work when minting multiple times with tracker UTXOs', async () => {
      const { deployPsbt, tokenId } = await deployToken(metadata)

      // First mint with tracker UTXO
      const firstMinterUtxo = toTrackerUtxo(deployPsbt.getUtxo(0))
      const firstMint = await mintToken(firstMinterUtxo, tokenId, metadata)
      expect(firstMint.mintTxid).to.be.a('string')

      // Get next minter from the mint result and convert to tracker
      const nextMinterUtxo = toTrackerUtxo(firstMint.mintPsbt.getUtxo(0))

      // Second mint with tracker UTXO
      const secondMint = await mintToken(nextMinterUtxo, tokenId, metadata)
      expect(secondMint.mintTxid).to.be.a('string')
    })

    it('should handle mix of tracker and full script UTXOs (different deploys)', async () => {
      // First deployment - use tracker UTXO
      const deploy1 = await deployToken(metadata)
      const trackerMinterUtxo = toTrackerUtxo(deploy1.deployPsbt.getUtxo(0))
      const mint1 = await mintToken(trackerMinterUtxo, deploy1.tokenId, metadata)
      expect(mint1.mintTxid).to.be.a('string')

      // Second deployment - use full script UTXO
      const deploy2 = await deployToken(metadata)
      const fullMinterUtxo = deploy2.deployPsbt.getUtxo(0)
      const mint2 = await mintToken(fullMinterUtxo, deploy2.tokenId, metadata)
      expect(mint2.mintTxid).to.be.a('string')
    })
  })

  describe('CAT20 send with tracker UTXOs', () => {
    let cat20Generator: TestCAT20Generator

    before(async () => {
      const metadata = formatMetadata({
        name: 'Send Test Token',
        symbol: 'STT',
        decimals: 0n,
        hasAdmin: false,
        max: 21000n,
        limit: 1000n,
        premine: 0n,
        preminerAddr: tokenReceiverAddr,
        minterMd5: CAT20OpenMinter.artifact.md5,
      })
      cat20Generator = await TestCAT20Generator.init(metadata)
    })

    it('should send token with tracker-style token UTXO', async () => {
      // Generate a token UTXO with full script
      const tokenUtxo = await cat20Generator.mintTokenToHash160(tokenReceiverAddr, 500n)

      // Convert to tracker UTXO (script becomes hash)
      const trackerTokenUtxo = toTrackerUtxo(tokenUtxo)

      // Send should work with tracker UTXO
      const result = await singleSend(
        testSigner,
        testProvider,
        cat20Generator.deployInfo.minterScriptHash,
        [trackerTokenUtxo],
        [{ address: tokenReceiverAddr, amount: 300n }],
        tokenReceiverAddr,
        await testProvider.getFeeRate(),
        cat20Generator.deployInfo.hasAdmin,
        cat20Generator.deployInfo.adminScriptHash
      )

      expect(result.sendTxId).to.be.a('string')
      expect(result.sendPsbt).to.exist
    })

    it('should send token with multiple tracker-style token UTXOs', async () => {
      // Generate two token UTXOs with full scripts
      const token1 = await cat20Generator.mintTokenToHash160(tokenReceiverAddr, 600n)
      const token2 = await cat20Generator.mintTokenToHash160(tokenReceiverAddr, 700n)

      // Convert both to tracker UTXOs
      const trackerToken1 = toTrackerUtxo(token1)
      const trackerToken2 = toTrackerUtxo(token2)

      // Send should work with multiple tracker UTXOs
      const result = await singleSend(
        testSigner,
        testProvider,
        cat20Generator.deployInfo.minterScriptHash,
        [trackerToken1, trackerToken2],
        [{ address: tokenReceiverAddr, amount: 1000n }],
        tokenReceiverAddr,
        await testProvider.getFeeRate(),
        cat20Generator.deployInfo.hasAdmin,
        cat20Generator.deployInfo.adminScriptHash
      )

      expect(result.sendTxId).to.be.a('string')
    })
  })

  describe('CAT20 burn with tracker UTXOs', () => {
    let cat20Generator: TestCAT20Generator

    before(async () => {
      const metadata = formatMetadata({
        name: 'Burn Test Token',
        symbol: 'BTT',
        decimals: 0n,
        hasAdmin: false,
        max: 21000n,
        limit: 1000n,
        premine: 0n,
        preminerAddr: tokenReceiverAddr,
        minterMd5: CAT20OpenMinter.artifact.md5,
      })
      cat20Generator = await TestCAT20Generator.init(metadata)
    })

    it('should burn token with tracker-style token UTXO', async () => {
      // Generate a token UTXO with full script
      const tokenUtxo = await cat20Generator.mintTokenToHash160(tokenReceiverAddr, 500n)

      // Convert to tracker UTXO (script becomes hash)
      const trackerTokenUtxo = toTrackerUtxo(tokenUtxo)

      // Burn should work with tracker UTXO
      const result = await runWithDryCheck(testProvider, burnToken)(
        testSigner,
        testProvider,
        cat20Generator.deployInfo.minterScriptHash,
        [trackerTokenUtxo],
        await testProvider.getFeeRate(),
        cat20Generator.deployInfo.hasAdmin,
        cat20Generator.deployInfo.adminScriptHash
      )

      expect(result.guardPsbt).to.exist
      expect(result.burnPsbt).to.exist
    })

    it('should burn multiple tokens with tracker-style token UTXOs', async () => {
      // Generate two token UTXOs with full scripts
      const token1 = await cat20Generator.mintTokenToHash160(tokenReceiverAddr, 300n)
      const token2 = await cat20Generator.mintTokenToHash160(tokenReceiverAddr, 400n)

      // Convert both to tracker UTXOs
      const trackerToken1 = toTrackerUtxo(token1)
      const trackerToken2 = toTrackerUtxo(token2)

      // Burn should work with multiple tracker UTXOs
      const result = await runWithDryCheck(testProvider, burnToken)(
        testSigner,
        testProvider,
        cat20Generator.deployInfo.minterScriptHash,
        [trackerToken1, trackerToken2],
        await testProvider.getFeeRate(),
        cat20Generator.deployInfo.hasAdmin,
        cat20Generator.deployInfo.adminScriptHash
      )

      expect(result.guardPsbt).to.exist
      expect(result.burnPsbt).to.exist
    })
  })

  describe('CAT721 send with tracker UTXOs', () => {
    let cat721Generator: TestCAT721Generator

    before(async () => {
      const nftMetadata: ClosedMinterCAT721Meta = {
        name: 'Tracker NFT Collection',
        symbol: 'TNC',
        description: 'Test NFT collection for tracker compatibility',
        max: 100n,
        icon: '',
        minterMd5: CAT721ClosedMinter.artifact.md5,
        issuerAddress: tokenReceiverAddr,
      }
      cat721Generator = await TestCAT721Generator.init(nftMetadata)
    })

    it('should send NFT with tracker-style NFT UTXO', async () => {
      // Generate an NFT UTXO with full script
      const nftUtxo = await cat721Generator.mintThenTransfer(tokenReceiverAddr)

      // Convert to tracker UTXO
      const trackerNftUtxo = toTrackerUtxo(nftUtxo)

      // Send should work with tracker UTXO
      const result = await singleSendNft(
        testSigner,
        testProvider,
        cat721Generator.minterScriptHash,
        [trackerNftUtxo],
        [tokenReceiverAddr],
        await testProvider.getFeeRate()
      )

      expect(result.sendTxId).to.be.a('string')
      expect(result.sendPsbt).to.exist
    })

    it('should send multiple NFTs with tracker-style NFT UTXOs', async () => {
      // Generate two NFT UTXOs with full scripts
      const nft1 = await cat721Generator.mintThenTransfer(tokenReceiverAddr)
      const nft2 = await cat721Generator.mintThenTransfer(tokenReceiverAddr)

      // Convert both to tracker UTXOs
      const trackerNft1 = toTrackerUtxo(nft1)
      const trackerNft2 = toTrackerUtxo(nft2)

      // Send should work with multiple tracker UTXOs
      const result = await runWithDryCheck(testProvider, singleSendNft)(
        testSigner,
        testProvider,
        cat721Generator.minterScriptHash,
        [trackerNft1, trackerNft2],
        [tokenReceiverAddr, tokenReceiverAddr],
        await testProvider.getFeeRate()
      )

      expect(result.sendTxId).to.be.a('string')
    })
  })

  describe('CAT721 ClosedMinter with tracker UTXOs', () => {
    let cat721Generator: TestCAT721Generator

    before(async () => {
      const nftMetadata: ClosedMinterCAT721Meta = {
        name: 'Mint NFT Collection',
        symbol: 'MNC',
        description: 'Test NFT collection for mint tracker compatibility',
        max: 100n,
        icon: '',
        minterMd5: CAT721ClosedMinter.artifact.md5,
        issuerAddress: tokenReceiverAddr,
      }
      cat721Generator = await TestCAT721Generator.init(nftMetadata)
    })

    it('should mint NFT with tracker-style minter UTXO', async () => {
      // Get minter UTXO and convert to tracker format
      const minterUtxo = cat721Generator.minterPsbt.getUtxo(0)
      const trackerMinterUtxo = toTrackerUtxo(minterUtxo)

      // Mint should work with tracker UTXO
      const state = CAT721ClosedMinter.deserializeState(trackerMinterUtxo.data)
      const feeUtxos = await testProvider.getUtxos(address)
      const result = await runWithDryCheck(testProvider, mintClosedMinterNft)(
        testSigner,
        testSigner,
        testProvider,
        trackerMinterUtxo,
        {
          contentType: 'image/png',
          contentBody: Buffer.from('test nft content for tracker compatibility').toString('hex'),
          nftmetadata: {
            image: 'https://example.com/nft.png',
            localId: state.nextLocalId,
          },
        },
        cat721Generator.deployInfo.collectionId,
        cat721Generator.deployInfo.metadata,
        tokenReceiverAddr,
        address,
        feeUtxos,
        await testProvider.getFeeRate()
      )

      expect(result.mintTxId).to.be.a('string')
      expect(result.mintPsbt).to.exist
    })
  })

  describe('CAT721 OpenMinter with tracker UTXOs', () => {
    let openMinterMetadata: OpenMinterCAT721Meta
    let nftOpenMinterMerkleTreeData: CAT721OpenMinterMerkleTreeData
    let deployPsbt: ExtPsbt
    let collectionId: string

    before(async () => {
      openMinterMetadata = {
        name: 'OpenMinter NFT Collection',
        symbol: 'OMNC',
        description: 'Test OpenMinter collection for tracker compatibility',
        max: 100n,
        premine: 0n,
        preminerAddr: tokenReceiverAddr,
        icon: '',
        minterMd5: CAT721OpenMinter.artifact.md5,
      }

      // Generate merkle tree data
      const nftMerkleLeafList: CAT721MerkleLeaf[] = []
      for (let i = 0n; i < openMinterMetadata.max; i++) {
        const nft = {
          contentType: 'image/png',
          contentBody: Buffer.from(`NFT ${i}`).toString('hex'),
          nftmetadata: { localId: i },
        }
        const nftStr = MetadataSerializer.serialize('NFT', {
          metadata: nft.nftmetadata,
          content: { type: nft.contentType, body: nft.contentBody },
        })
        nftMerkleLeafList.push({
          contentDataHash: sha256(nftStr),
          localId: i,
          isMined: false,
        })
      }
      nftOpenMinterMerkleTreeData = new CAT721OpenMinterMerkleTreeData(nftMerkleLeafList, HEIGHT)

      // Deploy collection
      const deployResult = await runWithDryCheck(testProvider, deployOpenMinterCollection)(
        testSigner,
        testProvider,
        { metadata: openMinterMetadata },
        nftOpenMinterMerkleTreeData.merkleRoot,
        await testProvider.getFeeRate()
      )
      deployPsbt = deployResult.deployPsbt
      collectionId = deployResult.collectionId
    })

    it('should mint NFT with tracker-style OpenMinter UTXO', async () => {
      // Get minter UTXO and convert to tracker format
      const minterUtxo = deployPsbt.getUtxo(0)
      const trackerMinterUtxo = toTrackerUtxo(minterUtxo)

      // Prepare mint data
      const minterState = CAT721OpenMinter.deserializeState(trackerMinterUtxo.data)
      const index = Number(minterState.nextLocalId)
      const oldLeaf = nftOpenMinterMerkleTreeData.getLeaf(index)
      const newLeaf: CAT721MerkleLeaf = { ...oldLeaf, isMined: true }
      const updateLeafInfo = nftOpenMinterMerkleTreeData.updateLeaf(newLeaf, index)

      const nftStorage = {
        contentType: 'image/png',
        contentBody: Buffer.from(`NFT ${index}`).toString('hex'),
        nftmetadata: { localId: BigInt(index) },
      }

      // Mint should work with tracker UTXO
      const result = await runWithDryCheck(testProvider, mintOpenMinterNft)(
        testSigner,
        testProvider,
        trackerMinterUtxo,
        updateLeafInfo.neighbor as MerkleProof,
        updateLeafInfo.neighborType as ProofNodePos,
        updateLeafInfo.merkleRoot,
        nftStorage,
        collectionId,
        openMinterMetadata,
        tokenReceiverAddr,
        address,
        await testProvider.getFeeRate()
      )

      expect(result.mintTxId).to.be.a('string')
      expect(result.mintPsbt).to.exist
    })
  })

  describe('CAT721 burn with tracker UTXOs', () => {
    let cat721Generator: TestCAT721Generator

    before(async () => {
      const nftMetadata: ClosedMinterCAT721Meta = {
        name: 'Burn NFT Collection',
        symbol: 'BNC',
        description: 'Test NFT collection for burn tracker compatibility',
        max: 100n,
        icon: '',
        minterMd5: CAT721ClosedMinter.artifact.md5,
        issuerAddress: tokenReceiverAddr,
      }
      cat721Generator = await TestCAT721Generator.init(nftMetadata)
    })

    it('should burn NFT with tracker-style NFT UTXO', async () => {
      // Generate an NFT UTXO with full script
      const nftUtxo = await cat721Generator.mintNftToAddress(tokenReceiverAddr)

      // Convert to tracker UTXO
      const trackerNftUtxo = toTrackerUtxo(nftUtxo)

      // Burn should work with tracker UTXO
      const result = await runWithDryCheck(testProvider, burnNft)(
        testSigner,
        testProvider,
        cat721Generator.minterScriptHash,
        [trackerNftUtxo],
        await testProvider.getFeeRate()
      )

      expect(result.guardPsbt).to.exist
      expect(result.burnPsbt).to.exist
    })

    it('should burn multiple NFTs with tracker-style NFT UTXOs', async () => {
      // Generate two NFT UTXOs with full scripts
      const nft1 = await cat721Generator.mintNftToAddress(tokenReceiverAddr)
      const nft2 = await cat721Generator.mintNftToAddress(tokenReceiverAddr)

      // Convert both to tracker UTXOs
      const trackerNft1 = toTrackerUtxo(nft1)
      const trackerNft2 = toTrackerUtxo(nft2)

      // Burn should work with multiple tracker UTXOs
      const result = await burnNft(
        testSigner,
        testProvider,
        cat721Generator.minterScriptHash,
        [trackerNft1, trackerNft2],
        await testProvider.getFeeRate()
      )

      expect(result.guardPsbt).to.exist
      expect(result.burnPsbt).to.exist
    })
  })

  describe('Verify normalizeUtxoScripts behavior', () => {
    it('should accept UTXO with script hash', async () => {
      const metadata = formatMetadata({
        name: 'Hash Test',
        symbol: 'HT',
        decimals: 0n,
        hasAdmin: false,
        max: 1000n,
        limit: 100n,
        premine: 0n,
        preminerAddr: tokenReceiverAddr,
        minterMd5: CAT20OpenMinter.artifact.md5,
      })

      const { deployPsbt, tokenId } = await deployToken(metadata)
      const originalUtxo = deployPsbt.getUtxo(0)

      // Verify the script is currently full script
      expect(originalUtxo.script).to.have.length.greaterThan(64)

      // Convert to hash
      const trackerUtxo = toTrackerUtxo(originalUtxo)
      expect(trackerUtxo.script).to.have.length(64) // sha256 = 32 bytes = 64 hex chars

      // Should still work
      const result = await mintToken(trackerUtxo, tokenId, metadata)
      expect(result.mintTxid).to.be.a('string')
    })

    it('should accept UTXO with full script', async () => {
      const metadata = formatMetadata({
        name: 'Full Test',
        symbol: 'FT',
        decimals: 0n,
        hasAdmin: false,
        max: 1000n,
        limit: 100n,
        premine: 0n,
        preminerAddr: tokenReceiverAddr,
        minterMd5: CAT20OpenMinter.artifact.md5,
      })

      const { deployPsbt, tokenId } = await deployToken(metadata)
      const fullScriptUtxo = deployPsbt.getUtxo(0)

      // Should work with full script
      const result = await mintToken(fullScriptUtxo, tokenId, metadata)
      expect(result.mintTxid).to.be.a('string')
    })
  })
})
