import { expect, use } from 'chai'
import chaiAsPromised from 'chai-as-promised'
import { ByteString, toByteString, UTXO } from '@opcat-labs/scrypt-ts-opcat'
import { TestCAT20Generator } from '../../../utils/testCAT20Generator'
import { OpenMinterCAT20Meta } from '../../../../src/contracts/cat20/types'
import { loadAllArtifacts } from '../utils'
import { testSigner } from '../../../utils/testSigner'
import { outpoint2ByteString, toTokenOwnerAddress } from '../../../../src/utils'
import { CAT20OpenMinter } from '../../../../src/contracts/cat20/minters/cat20OpenMinter'
import { burnByAdmin } from '../../../../src/features/cat20/admin/burnByAdmin'
import { testProvider } from '../../../utils/testProvider'
import { runWithDryCheck, verifyTx } from '../../../utils'
import { formatMetadata } from '../../../../src/lib/metadata'
import { ConstantsLib } from '../../../../src/contracts'
import { CAT20Admin } from '../../../../src/contracts/cat20/cat20Admin'

use(chaiAsPromised)

describe('Test the feature `burnByAdmin` for `Cat20`', () => {
  let address: string
  let contractScriptHash: ByteString
  let cat20Generator: TestCAT20Generator
  let metadata: OpenMinterCAT20Meta

  before(async () => {
    loadAllArtifacts()

    address = await testSigner.getAddress()
    contractScriptHash = toTokenOwnerAddress(address, true)

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

  const getTokenUtxos = async function (
    generator: TestCAT20Generator,
    contractHash: string,
    n: number
  ) {
    const r: UTXO[] = []
    for (let index = 0; index < n; index++) {
      const utxo = await generator.mintTokenToHash160(
        contractHash,
        BigInt(Math.floor(Math.random() * 1000000))
      )
      r.push(utxo)
    }
    return r
  }

  describe('When sending tokens in a single tx', () => {
    it('should burnByAdmin one token utxo successfully', async () => {
      const tokenUtxos = await getTokenUtxos(
        cat20Generator,
        contractScriptHash,
        1
      )
      await testBurnByAdminResult(tokenUtxos)
    })
    it('should burnByAdmin multiple token utxos successfully', async () => {
      const tokenUtxos = await getTokenUtxos(
        cat20Generator,
        contractScriptHash,
        3
      )
      await testBurnByAdminResult(tokenUtxos)
    })
    it('should burnByAdmin tokens owned by a different (non-admin) p2pkh address', async () => {
      // Mint tokens to an unrelated address — admin should be able to burn these
      // without being the owner (the primary use case of burnByAdmin).
      // ownerAddr must be a valid P2PKH locking script: OP_DUP OP_HASH160 <20-byte-hash> OP_EQUALVERIFY OP_CHECKSIG
      const otherOwnerAddr = toByteString('76a914010101010101010101010101010101010101010188ac')
      const tokenUtxos = await getTokenUtxos(cat20Generator, otherOwnerAddr, 1)
      await testBurnByAdminResult(tokenUtxos)
    })
    it('should burnByAdmin tokens owned by a contract (sha256 hash owner)', async () => {
      // ownerAddr can also be a 32-byte contract script hash
      const contractOwnerAddr = toByteString('0101010101010101010101010101010101010101010101010101010101010101')
      const tokenUtxos = await getTokenUtxos(cat20Generator, contractOwnerAddr, 1)
      await testBurnByAdminResult(tokenUtxos)
    })
  })

  async function testBurnByAdminResult(cat20Utxos: UTXO[]) {
    const cat20Admin = new CAT20Admin(
      outpoint2ByteString(cat20Generator.deployInfo.tokenId)
    )
    cat20Admin.bindToUtxo(cat20Generator.getCat20AdminUtxo())
    const { guardPsbt, sendPsbt } = await  runWithDryCheck(testProvider, burnByAdmin)(
      testSigner,
      cat20Admin,
      cat20Admin.utxo!,
      testProvider,
      cat20Generator.deployInfo.minterScriptHash,
      cat20Utxos,
      await testProvider.getFeeRate(),
      cat20Generator.deployInfo.hasAdmin,
      cat20Generator.deployInfo.adminScriptHash
    )

    // check guard tx
    expect(guardPsbt).to.not.be.null
    verifyTx(guardPsbt, expect)

    // check burnByAdmin tx
    expect(sendPsbt).to.not.be.null
    verifyTx(sendPsbt, expect)

    cat20Generator.updateAdminTx(sendPsbt)
  }
})
