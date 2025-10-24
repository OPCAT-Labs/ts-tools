/* eslint-disable @typescript-eslint/no-unused-expressions */

import { expect, use } from 'chai'
import chaiAsPromised from 'chai-as-promised'
import { ByteString, UTXO } from '@opcat-labs/scrypt-ts-opcat'
import { TestCAT20Generator } from '../../../utils/testCAT20Generator'
import { OpenMinterCAT20Meta } from '../../../../src/contracts/cat20/types'
import { loadAllArtifacts } from '../utils'
import { testSigner } from '../../../utils/testSigner'
import { outpoint2ByteString, toTokenOwnerAddress } from '../../../../src/utils'
import { CAT20OpenMinter } from '../../../../src/contracts/cat20/minters/cat20OpenMinter'
import { freeze } from '../../../../src/features/cat20/freeze/freeze'
import { testProvider } from '../../../utils/testProvider'
import { verifyTx } from '../../../utils'
import { formatMetadata } from '../../../../src/lib/metadata'
import { ConstantsLib } from '../../../../src/contracts'
import { CAT20Admin } from '../../../../src/contracts/cat20/cat20Admin'

use(chaiAsPromised)

describe('Test the feature `freeze` for `Cat20`', () => {
  let address: string
  let contractScriptHash: ByteString
  let cat20ChangeAddr: ByteString
  let cat20Generator: TestCAT20Generator
  let metadata: OpenMinterCAT20Meta

  before(async () => {
    loadAllArtifacts()

    address = await testSigner.getAddress()
    contractScriptHash = toTokenOwnerAddress(address, true)
    cat20ChangeAddr = toTokenOwnerAddress(address)

    metadata = formatMetadata({
      tag: ConstantsLib.OPCAT_METADATA_TAG,
      name: 'c',
      symbol: 'C',
      decimals: 2n,
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
    it('should freeze one token utxo successfully', async () => {
      const tokenUtxos = await getTokenUtxos(
        cat20Generator,
        contractScriptHash,
        1
      )
      await testFreezeResult(tokenUtxos)
    })
    it('should freeze multiple token utxos successfully', async () => {
      const tokenUtxos = await getTokenUtxos(
        cat20Generator,
        contractScriptHash,
        3
      )
      await testFreezeResult(tokenUtxos)
    })
  })

  async function testFreezeResult(cat20Utxos: UTXO[]) {
    const cat20Admin = new CAT20Admin(
      outpoint2ByteString(cat20Generator.deployInfo.tokenId)
    )
    cat20Admin.bindToUtxo(cat20Generator.getCat20AdminUtxo())
    const { guardPsbt, sendPsbt } = await freeze(
      testSigner,
      cat20Admin,
      cat20Admin.utxo!,
      testProvider,
      cat20Generator.deployInfo.minterScriptHash,
      cat20Generator.deployInfo.adminScriptHash,
      cat20Utxos,
      await testProvider.getFeeRate()
    )

    // check guard tx
    expect(guardPsbt).to.not.be.null
    verifyTx(guardPsbt, expect)

    // check freeze tx
    expect(sendPsbt).to.not.be.null
    verifyTx(sendPsbt, expect)

    cat20Generator.updateAdminTx(sendPsbt)
  }
})
