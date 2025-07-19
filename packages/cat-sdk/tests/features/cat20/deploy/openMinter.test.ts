/* eslint-disable @typescript-eslint/no-unused-expressions */

import { expect, use } from 'chai'
import chaiAsPromised from 'chai-as-promised'
import { loadAllArtifacts } from '../utils'
import { testSigner } from '../../../utils/testSigner'
import { OpenMinterCAT20Meta } from '../../../../src/contracts/cat20/types'
import { toTokenOwnerAddress } from '../../../../src/utils'
import { deployToken } from '../utils'
import { CAT20State } from '../../../../src/contracts/cat20/types'
import { ContractPeripheral } from '../../../../src/utils/contractPeripheral'
import { CAT20 } from '../../../../src/contracts/cat20/cat20'
import { CAT20Guard } from '../../../../src/contracts/cat20/cat20Guard'
import { toHex } from '@opcat-labs/scrypt-ts-opcat'
import { CAT20OpenMinter } from '../../../../src/contracts/cat20/minters/cat20OpenMinter'
import { verifyTx } from '../../../utils'
import { formatMetadata } from '../../../../src/lib/metadata'
import { ConstantsLib } from '../../../../src/contracts'
  use(chaiAsPromised)

describe('Test the feature `deploy` for `openMinterV2`', () => {
  let metadata: OpenMinterCAT20Meta

  before(async () => {
    loadAllArtifacts()
    const address = await testSigner.getAddress()
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
  })

  describe('When deploying a new token', () => {
    it('should build and sign the genesis and reveal txns successfully', async () => {
      const { genesisPsbt, deployPsbt } = await deployToken(metadata)

      // test genesis tx
      expect(genesisPsbt.isFinalized).to.not.be.null
      verifyTx(genesisPsbt, expect)

      // test deploy tx
      expect(deployPsbt.isFinalized).to.not.be.null
      verifyTx(deployPsbt, expect)
    })

    it('shoud premine the token if applicable', async () => {
      const { deployPsbt, preminePsbt, minterScriptHash } = await deployToken(
        metadata
      )

      // test premine tx
      expect(preminePsbt).to.not.be.null
      verifyTx(preminePsbt!, expect)
      verifyTx(deployPsbt!, expect)

      const mintedTokenState: CAT20State = {
        tag: ConstantsLib.OPCAT_CAT20_TAG,
        ownerAddr: metadata.preminerAddr!,
        amount: metadata.premine,
      }
      const expectTokenScript = new CAT20(
        minterScriptHash,
        ContractPeripheral.scriptHash(new CAT20Guard())
      ).lockingScript.toHex()
      const tokenOutputIndex = 2

      // ensure it has the minted token output
      expect(toHex(preminePsbt!.txOutputs[tokenOutputIndex].script)).to.equal(
        expectTokenScript
      )
      expect(toHex(preminePsbt!.txOutputs[tokenOutputIndex].data)).to.equal(
        CAT20.serializeState(mintedTokenState)
      )
    })
  })
})
