/* eslint-disable @typescript-eslint/no-unused-expressions */

import chaiAsPromised from 'chai-as-promised'
import { deployToken, loadAllArtifacts, mintToken } from '../utils'
import { CAT20OpenMinter } from '../../../../src/contracts/cat20/minters/cat20OpenMinter'
import { OpenMinterCAT20Meta } from '../../../../src/contracts/cat20/types'
import { ByteString, UTXO, ExtPsbt } from '@opcat-labs/scrypt-ts-opcat'
import { testSigner } from '../../../utils/testSigner'
import { toTokenOwnerAddress } from '../../../../src/utils'
import { use, expect } from 'chai'
import { ContractPeripheral } from '../../../../src/utils/contractPeripheral'
import { CAT20State } from '../../../../src/contracts/cat20/types'
import { CAT20OpenMinterState } from '../../../../src/contracts/cat20/types'
import { CAT20_AMOUNT } from '../../../../src/contracts/cat20/types'
import { CAT20OpenMinterPeripheral } from '../../../../src/utils/contractPeripheral'
import { verifyTx } from '../../../utils'
import { formatMetadata } from '../../../../src/lib/metadata'
import { CAT20 } from '../../../../src/contracts/cat20/cat20'
import { ConstantsLib } from '../../../../src/contracts'
use(chaiAsPromised)

describe('Test the feature `mint` for `CAT20OpenMinter`, premine=0', () => {
  let address: string
  let tokenReceiverAddr: ByteString

  let tokenId: string
  let tokenScriptHash: string
  let minterScriptHash: string
  let metadata: OpenMinterCAT20Meta

  let spentMinterPsbt: ExtPsbt

  before(async () => {
    loadAllArtifacts()

    address = await testSigner.getAddress()
    tokenReceiverAddr = toTokenOwnerAddress(address)
    metadata = formatMetadata({
      name: 'c',
      symbol: 'C',
      decimals: 2n,
      hasAdmin: false,
      max: 21000000n,
      limit: 1000n,
      premine: 0n,
      preminerAddr: tokenReceiverAddr,
      minterMd5: CAT20OpenMinter.artifact.md5,
    })

    const {
      deployPsbt,
      tokenId: deployedTokenId,
      tokenScriptHash: deployedTokenScriptHash,
      minterScriptHash: deployedMinterScriptHash,
    } = await deployToken(metadata)

    tokenId = deployedTokenId
    tokenScriptHash = deployedTokenScriptHash
    minterScriptHash = deployedMinterScriptHash
    spentMinterPsbt = deployPsbt
  })

  describe('When minting an existed token', () => {
    it('should mint successfully, if premine is zero', async () => {
      const cat20MinterUtxo = spentMinterPsbt.getUtxo(0)
      await testMintResult(
        cat20MinterUtxo,
        minterScriptHash,
        [10500n, 10499n],
        1000n * 100n
      )
    })
    it('should mint a new token successfully', async () => {
      // use the second minter in previous outputs
      const cat20MinterUtxo = spentMinterPsbt.getUtxo(1)
      await testMintResult(
        cat20MinterUtxo,
        minterScriptHash,
        [5249n, 5249n],
        1000n * 100n
      )
    })
  })

  async function testMintResult(
    cat20MinterUtxo: UTXO,
    _minterScriptHash: string,
    expectedNextMinterCounts: CAT20_AMOUNT[],
    expectedMintedAmount: CAT20_AMOUNT
  ) {
    const { mintPsbt } = await mintToken(cat20MinterUtxo, tokenId, metadata)
    expect(mintPsbt).to.not.be.null
    verifyTx(mintPsbt, expect)

    let outputIndex = 0
    for (let i = 0; i < expectedNextMinterCounts.length; i++) {
      // ensure a new minter is created
      const nextMinterOutputIndex = outputIndex++
      const nextMinter = CAT20OpenMinterPeripheral.createMinter(
        tokenId,
        metadata
      )
      const nextMinterState: CAT20OpenMinterState = {
        tokenScriptHash: tokenScriptHash,
        hasMintedBefore: true,
        remainingCount: expectedNextMinterCounts[i],
      }
      expect(mintPsbt.getUtxo(nextMinterOutputIndex).script).to.eq(
        nextMinter.lockingScript.toHex()
      )
      expect(mintPsbt.getUtxo(nextMinterOutputIndex).data).to.eq(
        CAT20OpenMinter.serializeState(nextMinterState)
      )
    }

    // ensure the minted token is sent to the receiver
    const tokenOutputIndex = outputIndex
    const mintedTokenState: CAT20State = {
      amount: expectedMintedAmount,
      ownerAddr: tokenReceiverAddr,
    }
    expect(
      ContractPeripheral.scriptHash(mintPsbt.getUtxo(tokenOutputIndex).script)
    ).to.eq(tokenScriptHash)
    expect(mintPsbt.getUtxo(tokenOutputIndex).data).to.eq(
      CAT20.serializeState(mintedTokenState)
    )

    // update the reference
    spentMinterPsbt = mintPsbt
  }
})
