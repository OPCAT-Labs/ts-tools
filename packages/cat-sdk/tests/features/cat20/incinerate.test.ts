/* eslint-disable @typescript-eslint/no-unused-expressions */

import chaiAsPromised from 'chai-as-promised'
import { expect, use } from 'chai'
import { testSigner } from '../../utils/testSigner'
import { testProvider } from '../../utils/testProvider'
import { loadAllArtifacts } from './utils'
import { ByteString, UTXO } from '@opcat-labs/scrypt-ts'
import { toTokenOwnerAddress } from '../../../src/utils'
import { OpenMinterCAT20Meta } from '../../../src/contracts/cat20/types'
import { TestCAT20Generator } from '../../utils/testCAT20Generator'
import { CAT20ClosedMinter } from '../../../src/contracts/cat20/minters/cat20ClosedMinter'
import { incinerate } from '../../../src/features/cat20/incinerate'
import { CAT20Incinerator } from '../../../src/contracts/cat20Incinerator'
import { ContractPeripheral } from '../../../src/utils/contractPeripheral'
import { CAT20Guard } from '../../../src/contracts/cat20/cat20Guard'
import { verifyTx } from '../../utils'
import { formatMetadata } from '../../../src/lib/metadata'
import { ConstantsLib } from '../../../src/contracts'
use(chaiAsPromised)

describe('Test the feature `incinerate` for `CAT20`', () => {
  let toReceiverAddr: ByteString
  let metadata: OpenMinterCAT20Meta
  let cat20Generater: TestCAT20Generator

  before(async () => {
    loadAllArtifacts()

    const incinerator = new CAT20Incinerator(
      ContractPeripheral.scriptHash(new CAT20Guard())
    )
    toReceiverAddr = toTokenOwnerAddress(
      incinerator.lockingScript.toHex(),
      true
    )

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

  describe('When incinerate tokens in a single tx', () => {
    it('should incinerate one token utxo successfully', async () => {
      await testIncinerateResult(
        await getTokenUtxos(cat20Generater, toReceiverAddr, 1)
      )
    })

    it('should incinerate multiple token utxos successfully', async () => {
      await testIncinerateResult(
        await getTokenUtxos(cat20Generater, toReceiverAddr, 2)
      )
    })
  })

  async function testIncinerateResult(cat20Utxos: UTXO[]) {
    const { guardPsbt, burnPsbt } = await incinerate(
      testSigner,
      testProvider,
      cat20Generater.deployInfo.minterScriptHash,
      cat20Utxos,
      await testProvider.getFeeRate()
    )

    // check guard tx
    expect(guardPsbt).not.to.be.undefined
    verifyTx(guardPsbt, expect)

    // check send tx
    expect(burnPsbt).not.to.be.undefined
    verifyTx(burnPsbt, expect)
  }
})
