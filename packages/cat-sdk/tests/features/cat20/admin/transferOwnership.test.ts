import { expect, use } from 'chai'
import chaiAsPromised from 'chai-as-promised'
import {
  DefaultSigner,
  hash160,
  Networks,
  PrivateKey,
  PubKeyHash,
  Signer,
} from '@opcat-labs/scrypt-ts-opcat'
import { TestCAT20Generator } from '../../../utils/testCAT20Generator'
import { OpenMinterCAT20Meta } from '../../../../src/contracts/cat20/types'
import { loadAllArtifacts } from '../utils'
import { testSigner } from '../../../utils/testSigner'
import { outpoint2ByteString, toTokenOwnerAddress } from '../../../../src/utils'
import { CAT20OpenMinter } from '../../../../src/contracts/cat20/minters/cat20OpenMinter'
import { transferOwnership } from '../../../../src/features/cat20/admin/transferOwnership'
import { testProvider } from '../../../utils/testProvider'
import { verifyTx } from '../../../utils'
import { formatMetadata } from '../../../../src/lib/metadata'
import { ConstantsLib } from '../../../../src/contracts'
import { CAT20Admin } from '../../../../src/contracts/cat20/cat20Admin'

use(chaiAsPromised)

describe('Test the feature `transferOwnership` for `Cat20`', () => {
  let address: string
  let cat20Generator: TestCAT20Generator
  let metadata: OpenMinterCAT20Meta

  before(async () => {
    loadAllArtifacts()

    address = await testSigner.getAddress()

    metadata = formatMetadata({
      tag: ConstantsLib.OPCAT_METADATA_TAG,
      name: 'c',
      symbol: 'C',
      decimals: 2n,
      hasAdmin: true,
      max: 21000000n,
      limit: 1000n,
      premine: 3150000n,
      preminerAddr: toTokenOwnerAddress(address),
      minterMd5: CAT20OpenMinter.artifact.md5,
    })
    cat20Generator = await TestCAT20Generator.init(metadata)
  })

  describe('When transferOwnership in a single tx', () => {
    it('should transferOwnership successfully', async () => {
      const testSigner2 = new DefaultSigner(
        PrivateKey.fromRandom(Networks.testnet)
      )
      const testSigner3 = new DefaultSigner(
        PrivateKey.fromRandom(Networks.testnet)
      )
      const newPubKeyHash2 = hash160(await testSigner2.getPublicKey())
      const newPubKeyHash3 = hash160(await testSigner3.getPublicKey())
      // transfer admin to newAddress2
      await testTransferOwnershipResult(testSigner, newPubKeyHash2)
      // check signer2 have admin permission
      // test new admin (testSigner2) transfer admin to newAddress3
      await testTransferOwnershipResult(testSigner2, newPubKeyHash3)
    })
  })

  async function testTransferOwnershipResult(
    currentSigner: Signer,
    newAddress: PubKeyHash
  ) {
    const cat20Admin = new CAT20Admin(
      outpoint2ByteString(cat20Generator.deployInfo.tokenId)
    )
    cat20Admin.bindToUtxo(cat20Generator.getCat20AdminUtxo())
    const { sendPsbt } = await transferOwnership(
      currentSigner,
      testSigner,
      cat20Admin,
      cat20Admin.utxo!,
      testProvider,
      newAddress,
      await testProvider.getFeeRate()
    )

    // check freeze tx
    expect(sendPsbt).to.not.be.null
    verifyTx(sendPsbt, expect)

    cat20Generator.updateAdminTx(sendPsbt)
  }
})
