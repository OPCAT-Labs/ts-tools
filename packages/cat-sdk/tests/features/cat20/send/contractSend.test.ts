/* eslint-disable @typescript-eslint/no-unused-expressions */

import { expect, use } from 'chai'
import chaiAsPromised from 'chai-as-promised'
import { ByteString, UTXO } from '@opcat-labs/scrypt-ts-opcat'
import { TestCAT20Generator } from '../../../utils/testCAT20Generator'
import { OpenMinterCAT20Meta } from '../../../../src/contracts/cat20/types'
import { loadAllArtifacts } from '../utils'
import { testSigner } from '../../../utils/testSigner'
import { toTokenOwnerAddress } from '../../../../src/utils'
import { ContractPeripheral } from '../../../../src/utils/contractPeripheral'
import { CAT20OpenMinter } from '../../../../src/contracts/cat20/minters/cat20OpenMinter'
import { contractSend } from '../../../../src/features/cat20/send/contractSend'
import { testProvider } from '../../../utils/testProvider'
import { CAT20_AMOUNT } from '../../../../src/contracts/cat20/types'
import { verifyTx } from '../../../utils'
import { formatMetadata } from '../../../../src/lib/metadata'
import { CAT20 } from '../../../../src/contracts/cat20/cat20'
import { ConstantsLib } from '../../../../src/contracts'

use(chaiAsPromised)

describe('Test the feature `contractSend` for `Cat20`', () => {
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
      tag: ConstantsLib.OPCAT_CAT20_METADATA_TAG,
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
    it('should contract send one token utxo successfully', async () => {
      const tokenUtxos = await getTokenUtxos(
        cat20Generator,
        contractScriptHash,
        1
      )
      const total = tokenUtxos.reduce(
        (acc, utxo) => acc + CAT20.deserializeState(utxo.data).amount,
        0n
      )
      const toReceiverAmount = total / 2n
      await testContractSendResult(
        tokenUtxos,
        toReceiverAmount,
        total - toReceiverAmount
      )
    })
    ;``
    it('should contract send multiple token utxos successfully', async () => {
      const tokenUtxos = await getTokenUtxos(
        cat20Generator,
        contractScriptHash,
        3
      )
      const total = tokenUtxos.reduce(
        (acc, utxo) => acc + CAT20.deserializeState(utxo.data).amount,
        0n
      )
      const toReceiverAmount = total / 2n
      await testContractSendResult(
        tokenUtxos,
        toReceiverAmount,
        total - toReceiverAmount
      )
    })
  })

  async function testContractSendResult(
    cat20Utxos: UTXO[],
    toReceiverAmount: CAT20_AMOUNT,
    tokenChangeAmount?: CAT20_AMOUNT
  ) {
    const { guardPsbt, sendPsbt } = await contractSend(
      testSigner,
      testProvider,
      cat20Generator.deployInfo.minterScriptHash,
      cat20Utxos,
      [{ address: contractScriptHash, amount: toReceiverAmount }],
      cat20ChangeAddr,
      await testProvider.getFeeRate()
    )

    // check guard tx
    expect(guardPsbt).to.not.be.null
    verifyTx(guardPsbt, expect)

    // check send tx
    expect(sendPsbt).to.not.be.null
    verifyTx(sendPsbt, expect)

    // verify token to receiver
    const toReceiverIndex = 0
    expect(
      ContractPeripheral.scriptHash(sendPsbt.getUtxo(toReceiverIndex).script)
    ).to.eq(cat20Generator.deployInfo.tokenScriptHash)
    expect(sendPsbt.getUtxo(toReceiverIndex).data).to.eq(
      CAT20.serializeState({
        tag: ConstantsLib.OPCAT_CAT20_TAG,
        amount: toReceiverAmount,
        ownerAddr: contractScriptHash,
      })
    )

    // verify token change
    if (tokenChangeAmount && tokenChangeAmount > 0n) {
      const tokenChangeOutputIndex = 1
      expect(
        ContractPeripheral.scriptHash(
          sendPsbt.getUtxo(tokenChangeOutputIndex).script
        )
      ).to.eq(cat20Generator.deployInfo.tokenScriptHash)
      expect(sendPsbt.getUtxo(tokenChangeOutputIndex).data).to.eq(
        CAT20.serializeState({
          tag: ConstantsLib.OPCAT_CAT20_TAG,
          amount: tokenChangeAmount,
          ownerAddr: cat20ChangeAddr,
        })
      )
    }
  }
})
