import { ByteString, Ripemd160 } from '@opcat-labs/scrypt-ts-opcat'
import { toTokenOwnerAddress } from '../../src/utils'
import { CAT20TokenInfo, formatMetadata } from '../../src/lib/metadata'
import { ExtPsbt, UTXO } from '@opcat-labs/scrypt-ts-opcat'
import { deployClosedMinterToken } from '../../src/features/cat20/deploy/closedMinter'
import { testSigner } from './testSigner'
import {
  CAT20_AMOUNT,
  ClosedMinterCAT20Meta,
} from '../../src/contracts/cat20/types'
import { mintClosedMinterToken } from '../../src/features/cat20/mint/closedMinter'
import { singleSend } from '../../src/features/cat20/send/singleSend'
import { verifyTx } from '.'
import { expect } from 'chai'
import { testProvider } from './testProvider'
import { CAT20GuardPeripheral, ContractPeripheral } from '../../src/utils/contractPeripheral'
import { ConstantsLib } from '../../src/contracts'

export class TestCAT20Generator {
  deployInfo: CAT20TokenInfo<ClosedMinterCAT20Meta> & {
    genesisPsbt: ExtPsbt
    deployPsbt: ExtPsbt
  }
  minterPsbt: ExtPsbt
  adminPsbt?: ExtPsbt


  get minterScriptHash() {
    return this.deployInfo.minterScriptHash
  }
  get guardScriptHashes() {
    return CAT20GuardPeripheral.getGuardScriptHashes()
  }

  constructor(
    deployInfo: CAT20TokenInfo<ClosedMinterCAT20Meta> & {
      genesisPsbt: ExtPsbt
      deployPsbt: ExtPsbt
    }
  ) {
    this.deployInfo = deployInfo
    this.minterPsbt = deployInfo.deployPsbt
  }

  static async init(info: ClosedMinterCAT20Meta) {
    const deployInfo = await deployClosedMinterToken(
      testSigner,
      testProvider,
      info,
      await testProvider.getFeeRate()
    )
    return new TestCAT20Generator(deployInfo)
  }

  private getCat20MinterUtxo() {
    return this.minterPsbt.getUtxo(0)
  }

  getCat20AdminUtxo() {
    // If adminPsbt is set (after admin operations), use it to get the updated admin UTXO
    // Otherwise, use the original admin UTXO from the deploy transaction
    if (this.adminPsbt) {
      return this.adminPsbt.getUtxo(0)
    }
    // Admin UTXO is the second output (index 1) in the deploy transaction
    return this.deployInfo.deployPsbt.getUtxo(1)
  }

  updateAdminTx(psbt: ExtPsbt) {
    // Update the admin PSBT reference after admin operations (burnByAdmin, transferOwnership)
    // The new admin UTXO is always at output index 0 in these transactions
    this.adminPsbt = psbt
  }

  async mintThenTransfer(addr: ByteString, amount: CAT20_AMOUNT) {
    const signerAddr = await testSigner.getAddress()
    const signerOwnerAddr = toTokenOwnerAddress(signerAddr)
    const mintInfo = await mintClosedMinterToken(
      testSigner,
      testProvider,
      this.getCat20MinterUtxo(),
      this.deployInfo.hasAdmin,
      this.deployInfo.adminScriptHash,
      this.deployInfo.genesisTxid,
      signerOwnerAddr,
      amount,
      signerAddr,
      await testProvider.getFeeRate()
    )
    verifyTx(mintInfo.mintPsbt, expect)
    this.minterPsbt = mintInfo.mintPsbt
    const transferInfo = await singleSend(
      testSigner,
      testProvider,
      this.deployInfo.minterScriptHash,
      [mintInfo.cat20Utxo],
      [
        {
          address: addr,
          amount,
        },
      ],
      signerAddr,
      await testProvider.getFeeRate(),
      this.deployInfo.hasAdmin,
      this.deployInfo.adminScriptHash
    )
    return transferInfo.newCAT20Utxos[0]
  }

  async mintTokenToAddr(addr: string, amount: CAT20_AMOUNT) {
    return this.mintThenTransfer(toTokenOwnerAddress(addr), amount)
  }

  async mintTokenToHash160(hash160: ByteString, amount: CAT20_AMOUNT) {
    return this.mintThenTransfer(hash160, amount)
  }
}

export type TestCat20 = {
  generator: TestCAT20Generator
  utxos: UTXO[]
  utxoTraces: Array<{
    prevTxHex: string
    prevTxInput: number
    prevPrevTxHex: string
  }>
}

export async function createCat20(
  amountList: bigint[],
  toAddress: string,
  symbol: string
): Promise<TestCat20> {
  const metadata = formatMetadata({
    name: `cat20_${symbol}`,
    symbol: `cat20_${symbol}`,
    decimals: 2n,
    hasAdmin: true,
    max: 21000000n,
    limit: 1000n,
    premine: 3150000n,
    preminerAddr: Ripemd160(toTokenOwnerAddress(toAddress)),
    minterMd5: '',
  })
  const cat20Generater = await TestCAT20Generator.init(metadata)
  const cat20: TestCat20 = {
    generator: cat20Generater,
    utxos: [],
    utxoTraces: [],
  }

  for (let i = 0; i < amountList.length; i++) {
    const utxo = await cat20Generater.mintTokenToAddr(toAddress, amountList[i])
    cat20.utxos.push(utxo)
    cat20.utxoTraces.push(
      ...(await CAT20GuardPeripheral.getBackTraceInfo(
        cat20Generater.deployInfo.minterScriptHash,
        [utxo],
        testProvider,
        cat20Generater.deployInfo.hasAdmin,
        cat20Generater.deployInfo.adminScriptHash
      ))
    )
  }
  return cat20
}
