/* eslint-disable @typescript-eslint/no-unused-expressions */

import chaiAsPromised from 'chai-as-promised'
import { expect, use } from 'chai'
import { ByteString, UTXO } from '@opcat-labs/scrypt-ts-opcat'
import {
  OpenMinterCAT20Meta,
  toTokenOwnerAddress,
  CAT20OpenMinter,
  formatMetadata,
  CAT20,
  mergeSendToken,
  calculateTokenTransferCount,
} from '../../../../src/index.js'
import { TestCAT20Generator } from '../../../utils/testCAT20Generator'
import { loadAllArtifacts } from '../utils'
import { testSigner } from '../../../utils/testSigner'
import { verifyTx, isLocalTest } from '../../../utils'
import { testProvider } from '../../../utils/testProvider'

use(chaiAsPromised)

describe('Test the feature `mergeSend` for `Cat20`', () => {
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
      name: 'c',
      symbol: 'C',
      decimals: 2n,
      hasAdmin: false,
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

  const calculateTotalAmount = (utxos: UTXO[]): bigint => {
    return utxos.reduce(
      (acc, utxo) => acc + CAT20.deserializeState(utxo.data).amount,
      0n
    )
  }

  describe('calculateTokenTransferCount function', () => {
    it('should return 1 for 1 input', () => {
      expect(calculateTokenTransferCount(1)).to.eq(1)
    })

    it('should return 1 for 10 inputs (boundary)', () => {
      expect(calculateTokenTransferCount(10)).to.eq(1)
    })

    it('should return 2 for 11 inputs', () => {
      expect(calculateTokenTransferCount(11)).to.eq(2)
    })

    it('should return 3 for 20 inputs', () => {
      expect(calculateTokenTransferCount(20)).to.eq(3)
    })

    it('should return 3 for 21 inputs', () => {
      expect(calculateTokenTransferCount(21)).to.eq(3)
    })

    it('should return 11 for 100 inputs', () => {
      expect(calculateTokenTransferCount(100)).to.eq(11)
    })
  })

  isLocalTest(testProvider) && describe('Error handling', () => {
    it('should throw error when inputTokenUtxos is empty', async () => {
      await expect(
        mergeSendToken(
          testSigner,
          testProvider,
          cat20Generator.deployInfo.minterScriptHash,
          [], // empty array
          [{ address: tokenReceiverAddr, amount: 100n }],
          tokenChangeAddr,
          await testProvider.getFeeRate(),
          cat20Generator.deployInfo.hasAdmin,
          cat20Generator.deployInfo.adminScriptHash
        )
      ).to.be.rejected
    })
  })

  describe('Boundary tests with amount validation', () => {
    isLocalTest(testProvider) && it('should handle exactly 1 input token UTXO', async () => {
      const toReceiverAmount = 100n
      const tokenUtxos = await getTokenUtxos(cat20Generator, address, 1)
      const totalInput = calculateTotalAmount(tokenUtxos)

      const result = await mergeSendToken(
        testSigner,
        testProvider,
        cat20Generator.deployInfo.minterScriptHash,
        tokenUtxos,
        [{ address: tokenReceiverAddr, amount: toReceiverAmount }],
        tokenChangeAddr,
        await testProvider.getFeeRate(),
        cat20Generator.deployInfo.hasAdmin,
        cat20Generator.deployInfo.adminScriptHash
      )

      // Should have no merge operations
      expect(result.merges.length).to.eq(0)

      // Verify transactions
      expect(result.finalSend.guardPsbt).to.not.be.null
      verifyTx(result.finalSend.guardPsbt, expect)
      expect(result.finalSend.sendPsbt).to.not.be.null
      verifyTx(result.finalSend.sendPsbt, expect)

      // Verify total amount is preserved
      const totalOutput = calculateTotalAmount(result.finalSend.newCAT20Utxos)
      expect(totalOutput).to.eq(totalInput)
    })

    isLocalTest(testProvider) && it('should handle exactly 10 input token UTXOs (boundary)', async () => {
      const toReceiverAmount = 100n
      const tokenUtxos = await getTokenUtxos(cat20Generator, address, 10)
      const totalInput = calculateTotalAmount(tokenUtxos)

      const result = await mergeSendToken(
        testSigner,
        testProvider,
        cat20Generator.deployInfo.minterScriptHash,
        tokenUtxos,
        [{ address: tokenReceiverAddr, amount: toReceiverAmount }],
        tokenChangeAddr,
        await testProvider.getFeeRate(),
        cat20Generator.deployInfo.hasAdmin,
        cat20Generator.deployInfo.adminScriptHash
      )

      // Should have no merge operations
      expect(result.merges.length).to.eq(0)

      // Verify transactions
      expect(result.finalSend.guardPsbt).to.not.be.null
      verifyTx(result.finalSend.guardPsbt, expect)
      expect(result.finalSend.sendPsbt).to.not.be.null
      verifyTx(result.finalSend.sendPsbt, expect)

      // Verify total amount is preserved
      const totalOutput = calculateTotalAmount(result.finalSend.newCAT20Utxos)
      expect(totalOutput).to.eq(totalInput)
    })

    // only run this test case in onchain test to avoid long time consumption and onchain broadcast failure
    isLocalTest(testProvider) && it('should handle exactly 11 input token UTXOs (just over limit)', async () => {
      const toReceiverAmount = 100n
      const tokenUtxos = await getTokenUtxos(cat20Generator, address, 11)
      const totalInput = calculateTotalAmount(tokenUtxos)

      const result = await mergeSendToken(
        testSigner,
        testProvider,
        cat20Generator.deployInfo.minterScriptHash,
        tokenUtxos,
        [{ address: tokenReceiverAddr, amount: toReceiverAmount }],
        tokenChangeAddr,
        await testProvider.getFeeRate(),
        cat20Generator.deployInfo.hasAdmin,
        cat20Generator.deployInfo.adminScriptHash
      )

      // Should have 1 merge operation
      expect(result.merges.length).to.eq(1)

      // Verify all merge transactions
      for (const merge of result.merges) {
        expect(merge.guardPsbt).to.not.be.null
        verifyTx(merge.guardPsbt, expect)
        expect(merge.sendPsbt).to.not.be.null
        verifyTx(merge.sendPsbt, expect)
      }

      // Verify final send transaction
      expect(result.finalSend.guardPsbt).to.not.be.null
      verifyTx(result.finalSend.guardPsbt, expect)
      expect(result.finalSend.sendPsbt).to.not.be.null
      verifyTx(result.finalSend.sendPsbt, expect)

      // Verify total amount is preserved
      const totalOutput = calculateTotalAmount(result.finalSend.newCAT20Utxos)
      expect(totalOutput).to.eq(totalInput)
    })

    it('should handle exactly 20 input token UTXOs', async () => {
      const toReceiverAmount = 100n
      const tokenUtxos = await getTokenUtxos(cat20Generator, address, 20)
      const totalInput = calculateTotalAmount(tokenUtxos)

      const result = await mergeSendToken(
        testSigner,
        testProvider,
        cat20Generator.deployInfo.minterScriptHash,
        tokenUtxos,
        [{ address: tokenReceiverAddr, amount: toReceiverAmount }],
        tokenChangeAddr,
        await testProvider.getFeeRate(),
        cat20Generator.deployInfo.hasAdmin,
        cat20Generator.deployInfo.adminScriptHash
      )

      // Should have 2 merge operations
      expect(result.merges.length).to.eq(2)

      // Verify all merge transactions
      for (const merge of result.merges) {
        expect(merge.guardPsbt).to.not.be.null
        verifyTx(merge.guardPsbt, expect)
        expect(merge.sendPsbt).to.not.be.null
        verifyTx(merge.sendPsbt, expect)
      }

      // Verify final send transaction
      expect(result.finalSend.guardPsbt).to.not.be.null
      verifyTx(result.finalSend.guardPsbt, expect)
      expect(result.finalSend.sendPsbt).to.not.be.null
      verifyTx(result.finalSend.sendPsbt, expect)

      // Verify total amount is preserved
      const totalOutput = calculateTotalAmount(result.finalSend.newCAT20Utxos)
      expect(totalOutput).to.eq(totalInput)
    })

    it('should handle exactly 20 input token UTXOs with progress callback', async () => {
      const toReceiverAmount = 100n
      const tokenUtxos = await getTokenUtxos(cat20Generator, address, 20)
      const totalInput = calculateTotalAmount(tokenUtxos)

      // Track callback invocations
      const startCalls: Array<{ currentIndex: number; totalTransfers: number; isFinalSend: boolean }> = []
      const endCalls: Array<{ currentIndex: number; totalTransfers: number; isFinalSend: boolean; result: unknown }> = []

      const result = await mergeSendToken(
        testSigner,
        testProvider,
        cat20Generator.deployInfo.minterScriptHash,
        tokenUtxos,
        [{ address: tokenReceiverAddr, amount: toReceiverAmount }],
        tokenChangeAddr,
        await testProvider.getFeeRate(),
        cat20Generator.deployInfo.hasAdmin,
        cat20Generator.deployInfo.adminScriptHash,
        undefined, // sendChangeData
        {
          onTransferStart: (progress) => {
            startCalls.push(progress)
          },
          onTransferEnd: (progress) => {
            endCalls.push(progress)
          },
        }
      )

      // Should have 2 merge operations
      expect(result.merges.length).to.eq(2)

      // Verify progressCallbacks were called correctly
      // For 20 inputs, we expect 3 transfers: 2 merges + 1 final send
      const expectedTotalTransfers = 3
      expect(startCalls.length).to.eq(expectedTotalTransfers)
      expect(endCalls.length).to.eq(expectedTotalTransfers)

      // Verify each callback has correct parameters
      for (let i = 0; i < expectedTotalTransfers; i++) {
        const isFinal = i === expectedTotalTransfers - 1

        // Verify onTransferStart
        expect(startCalls[i].currentIndex).to.eq(i)
        expect(startCalls[i].totalTransfers).to.eq(expectedTotalTransfers)
        expect(startCalls[i].isFinalSend).to.eq(isFinal)

        // Verify onTransferEnd
        expect(endCalls[i].currentIndex).to.eq(i)
        expect(endCalls[i].totalTransfers).to.eq(expectedTotalTransfers)
        expect(endCalls[i].isFinalSend).to.eq(isFinal)
        expect(endCalls[i].result).to.not.be.null
      }

      // Verify merge results match callback results
      for (let i = 0; i < result.merges.length; i++) {
        expect(endCalls[i].result).to.eq(result.merges[i])
      }
      // Verify final send result matches callback result
      expect(endCalls[expectedTotalTransfers - 1].result).to.eq(result.finalSend)

      // Verify all merge transactions
      for (const merge of result.merges) {
        expect(merge.guardPsbt).to.not.be.null
        verifyTx(merge.guardPsbt, expect)
        expect(merge.sendPsbt).to.not.be.null
        verifyTx(merge.sendPsbt, expect)
      }

      // Verify final send transaction
      expect(result.finalSend.guardPsbt).to.not.be.null
      verifyTx(result.finalSend.guardPsbt, expect)
      expect(result.finalSend.sendPsbt).to.not.be.null
      verifyTx(result.finalSend.sendPsbt, expect)

      // Verify total amount is preserved
      const totalOutput = calculateTotalAmount(result.finalSend.newCAT20Utxos)
      expect(totalOutput).to.eq(totalInput)
    })

    isLocalTest(testProvider) && it('should handle exactly 21 input token UTXOs', async () => {
      const toReceiverAmount = 100n
      const tokenUtxos = await getTokenUtxos(cat20Generator, address, 21)
      const totalInput = calculateTotalAmount(tokenUtxos)

      const result = await mergeSendToken(
        testSigner,
        testProvider,
        cat20Generator.deployInfo.minterScriptHash,
        tokenUtxos,
        [{ address: tokenReceiverAddr, amount: toReceiverAmount }],
        tokenChangeAddr,
        await testProvider.getFeeRate(),
        cat20Generator.deployInfo.hasAdmin,
        cat20Generator.deployInfo.adminScriptHash
      )

      // Should have 2 merge operations
      expect(result.merges.length).to.eq(2)

      // Verify all merge transactions
      for (const merge of result.merges) {
        expect(merge.guardPsbt).to.not.be.null
        verifyTx(merge.guardPsbt, expect)
        expect(merge.sendPsbt).to.not.be.null
        verifyTx(merge.sendPsbt, expect)
      }

      // Verify final send transaction
      expect(result.finalSend.guardPsbt).to.not.be.null
      verifyTx(result.finalSend.guardPsbt, expect)
      expect(result.finalSend.sendPsbt).to.not.be.null
      verifyTx(result.finalSend.sendPsbt, expect)

      // Verify total amount is preserved
      const totalOutput = calculateTotalAmount(result.finalSend.newCAT20Utxos)
      expect(totalOutput).to.eq(totalInput)
    })
    

    isLocalTest(testProvider) && it('should handle 100 input token UTXOs', async () => {
      const toReceiverAmount = 100n
      const tokenUtxos = await getTokenUtxos(cat20Generator, address, 100)
      const totalInput = calculateTotalAmount(tokenUtxos)

      const result = await mergeSendToken(
        testSigner,
        testProvider,
        cat20Generator.deployInfo.minterScriptHash,
        tokenUtxos,
        [{ address: tokenReceiverAddr, amount: toReceiverAmount }],
        tokenChangeAddr,
        await testProvider.getFeeRate(),
        cat20Generator.deployInfo.hasAdmin,
        cat20Generator.deployInfo.adminScriptHash
      )

      // Should have 10 merge operations
      expect(result.merges.length).to.eq(10)

      // Verify all merge transactions
      for (const merge of result.merges) {
        expect(merge.guardPsbt).to.not.be.null
        verifyTx(merge.guardPsbt, expect)
        expect(merge.sendPsbt).to.not.be.null
        verifyTx(merge.sendPsbt, expect)
      }

      // Verify final send transaction
      expect(result.finalSend.guardPsbt).to.not.be.null
      verifyTx(result.finalSend.guardPsbt, expect)
      expect(result.finalSend.sendPsbt).to.not.be.null
      verifyTx(result.finalSend.sendPsbt, expect)

      // Verify total amount is preserved
      const totalOutput = calculateTotalAmount(result.finalSend.newCAT20Utxos)
      expect(totalOutput).to.eq(totalInput)
    })
  })
})
