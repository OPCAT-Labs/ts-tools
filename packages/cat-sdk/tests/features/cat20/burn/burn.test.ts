/* eslint-disable @typescript-eslint/no-unused-expressions */

import { expect, use } from 'chai'
import chaiAsPromised from 'chai-as-promised'
import { OpenMinterCAT20Meta } from '../../../../src/contracts/cat20/types'
import { testSigner } from '../../../utils/testSigner'
import { TestCAT20Generator } from '../../../utils/testCAT20Generator'
import { burn } from '../../../../src/features/cat20/burn/burn'
import { testProvider } from '../../../utils/testProvider'
import { loadAllArtifacts } from '../utils'
import { ByteString, UTXO } from '@opcat-labs/scrypt-ts-opcat'
import { toTokenOwnerAddress } from '../../../../src/utils'
import { CAT20ClosedMinter } from '../../../../src/contracts/cat20/minters/cat20ClosedMinter'
import { verifyTx } from '../../../utils'
import { formatMetadata } from '../../../../src/lib/metadata'
import { ConstantsLib } from '../../../../src/contracts'
use(chaiAsPromised)

describe('Test the feature `burn` for `CAT20`', () => {
  let toReceiverAddr: ByteString
  let metadata: OpenMinterCAT20Meta
  let cat20Generater: TestCAT20Generator

  before(async () => {
    loadAllArtifacts()
    const address = await testSigner.getAddress()
    toReceiverAddr = toTokenOwnerAddress(address)

    metadata = formatMetadata({
      tag: ConstantsLib.OPCAT_METADATA_TAG,
      name: 'c',
      symbol: 'C',
      decimals: 2n,
      max: 21000000n,
      limit: 1000n,
      premine: 3150000n,
      preminerAddr: toReceiverAddr,
      minterMd5: CAT20ClosedMinter.artifact.md5,
    })
    cat20Generater = await TestCAT20Generator.init(metadata)
  })

  const getTokenUtxos = async function (
    generater: TestCAT20Generator,
    toReceiverAddr: string,
    n: number
  ) {
    const r: UTXO[] = []
    for (let index = 0; index < n; index++) {
      const utxo = await generater.mintTokenToHash160(
        toReceiverAddr,
        BigInt(Math.floor(Math.random() * 1000000))
      )
      r.push(utxo)
    }
    return r
  }

  describe('When burn tokens in a single tx', () => {
    it('should burn one token utxo successfully', async () => {
      await testBurnResult(
        await getTokenUtxos(cat20Generater, toReceiverAddr, 1)
      )
    })

    it('should burn multiple token utxos successfully', async () => {
      await testBurnResult(
        await getTokenUtxos(cat20Generater, toReceiverAddr, 2)
      )
    })
  })

  async function testBurnResult(cat20Utxos: UTXO[]) {
    const { guardPsbt, burnPsbt } = await burn(
      testSigner,
      testProvider,
      cat20Generater.deployInfo.minterScriptHash,
      cat20Utxos,
      await testProvider.getFeeRate()
    )

    // check guard tx
    expect(guardPsbt.isFinalized).not.to.be.undefined
    verifyTx(guardPsbt, expect)

    // check send tx
    expect(burnPsbt.isFinalized).not.to.be.undefined
    verifyTx(burnPsbt, expect)
  }
})
