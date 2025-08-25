/* eslint-disable @typescript-eslint/no-unused-expressions */

import chaiAsPromised from 'chai-as-promised'
import { expect, use } from 'chai'
import { ByteString, UTXO } from '@opcat-labs/scrypt-ts'
import { OpenMinterCAT20Meta } from '../../../../src/contracts/cat20/types'
import { TestCAT20Generator } from '../../../utils/testCAT20Generator'
import { loadAllArtifacts, singleSendToken } from '../utils'
import { testSigner } from '../../../utils/testSigner'
import { toTokenOwnerAddress } from '../../../../src/utils'
import { CAT20OpenMinter } from '../../../../src/contracts/cat20/minters/cat20OpenMinter'
import { CAT20_AMOUNT } from '../../../../src/contracts/cat20/types'
import { ContractPeripheral } from '../../../../src/utils/contractPeripheral'
import { verifyTx } from '../../../utils'
import { formatMetadata } from '../../../../src/lib/metadata'
import { CAT20 } from '../../../../src/contracts/cat20/cat20'
import { ConstantsLib } from '../../../../src/contracts'
use(chaiAsPromised)

describe('Test the feature `send` for `Cat20`', () => {
  let address: string
  let tokenReceiverAddr: ByteString
  let tokenChangeAddr: ByteString

  let metadata: OpenMinterCAT20Meta
  let cat20Generator: TestCAT20Generator

  before(async () => {
    loadAllArtifacts()
    address = await testSigner.getAddress()
    tokenReceiverAddr = toTokenOwnerAddress(address)
    tokenChangeAddr = toTokenOwnerAddress(address)

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
    generater: TestCAT20Generator,
    address: string,
    n: number
  ) {
    const r: UTXO[] = []
    for (let index = 0; index < n; index++) {
      const utxo = await generater.mintTokenToAddr(
        address,
        BigInt(Math.floor(Math.random() * 1000000))
      )
      r.push(utxo)
    }
    return r
  }

  describe('When sending tokens in a single tx', () => {
    it('should send one token utxo successfully', async () => {
      const toReceiverAmount = BigInt(metadata.decimals)
      const tokenUtxos = await getTokenUtxos(cat20Generator, address, 1)
      const total = tokenUtxos.reduce(
        (acc, utxo) => acc + CAT20.deserializeState(utxo.data).amount,
        0n
      )
      await testSendResult(
        tokenUtxos,
        toReceiverAmount,
        total - toReceiverAmount
      )
    })
    it('should send multiple token utxos successfully', async () => {
      const toReceiverAmount = BigInt(metadata.decimals)
      const tokenUtxos = await getTokenUtxos(cat20Generator, address, 3)
      const total = tokenUtxos.reduce(
        (acc, utxo) => acc + CAT20.deserializeState(utxo.data).amount,
        0n
      )
      await testSendResult(
        tokenUtxos,
        toReceiverAmount,
        total - toReceiverAmount
      )
    })
  })

  async function testSendResult(
    cat20Utxos: UTXO[],
    toReceiverAmount: CAT20_AMOUNT,
    toChangeAmount: CAT20_AMOUNT
  ) {
    const { guardPsbt, sendPsbt } = await singleSendToken(
      cat20Generator.deployInfo.minterScriptHash,
      toReceiverAmount,
      cat20Utxos,
      tokenReceiverAddr
    )

    // check guard tx
    expect(guardPsbt).to.not.be.null
    verifyTx(guardPsbt, expect)

    // check send tx
    expect(sendPsbt).to.not.be.null
    verifyTx(sendPsbt, expect)

    // verify token to receiver
    const toReceiverOutputIndex = 0
    expect(
      ContractPeripheral.scriptHash(
        sendPsbt.getUtxo(toReceiverOutputIndex).script
      )
    ).to.eq(cat20Generator.deployInfo.tokenScriptHash)
    expect(sendPsbt.getUtxo(toReceiverOutputIndex).data).to.eq(
      CAT20.serializeState({
        tag: ConstantsLib.OPCAT_CAT20_TAG,
        amount: toReceiverAmount,
        ownerAddr: tokenReceiverAddr,
      })
    )

    // verify token change
    if (toChangeAmount > 0n) {
      const tokenChangeOutputIndex = 1
      expect(
        ContractPeripheral.scriptHash(
          sendPsbt.getUtxo(tokenChangeOutputIndex).script
        )
      ).to.eq(cat20Generator.deployInfo.tokenScriptHash)
      expect(sendPsbt.getUtxo(tokenChangeOutputIndex).data).to.eq(
        CAT20.serializeState({
          tag: ConstantsLib.OPCAT_CAT20_TAG,
          amount: toChangeAmount,
          ownerAddr: tokenChangeAddr,
        })
      )
    }
  }
})
