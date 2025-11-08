import { CAT20Guard_6_6_2 } from '../../../src/contracts/cat20/cat20Guard_6_6_2'
import { CAT20Guard_6_6_4 } from '../../../src/contracts/cat20/cat20Guard_6_6_4'
import { CAT20Guard_12_12_2 } from '../../../src/contracts/cat20/cat20Guard_12_12_2'
import { CAT20Guard_12_12_4 } from '../../../src/contracts/cat20/cat20Guard_12_12_4'
import { CAT20ClosedMinter } from '../../../src/contracts/cat20/minters/cat20ClosedMinter'
import { CAT20OpenMinter } from '../../../src/contracts/cat20/minters/cat20OpenMinter'
import { CAT20 } from '../../../src/contracts/cat20/cat20'
import { CAT20Admin } from '../../../src/contracts/cat20/cat20Admin'
import { readArtifact } from '../../utils/index'
import { OpenMinterCAT20Meta } from '../../../src/contracts/cat20/types'
import { deployOpenMinterToken } from '../../../src/features/cat20/deploy/openMinter'
import { testSigner } from '../../utils/testSigner'
import { testProvider } from '../../utils/testProvider'
import { UTXO } from '@opcat-labs/scrypt-ts-opcat'
import { toTokenOwnerAddress } from '../../../src/utils'
import { mintOpenMinterToken } from '../../../src/features/cat20/mint/openMinter'
import { CAT20_AMOUNT } from '../../../src/contracts/cat20/types'
import { ByteString } from '@opcat-labs/scrypt-ts-opcat'
import { singleSend } from '../../../src/features/cat20/send/singleSend'
import { CAT20StateLib } from '../../../src/contracts/cat20/cat20StateLib'
import { CAT20GuardStateLib } from '../../../src/contracts/cat20/cat20GuardStateLib'
export const loadAllArtifacts = function () {
  //
  CAT20ClosedMinter.loadArtifact(
    readArtifact('artifacts/cat20/minters/cat20ClosedMinter.json')
  )
  CAT20Admin.loadArtifact(readArtifact('artifacts/cat20/cat20Admin.json'))
  CAT20OpenMinter.loadArtifact(
    readArtifact('artifacts/cat20/minters/cat20OpenMinter.json')
  )
  //
  CAT20.loadArtifact(readArtifact('artifacts/cat20/cat20.json'))
  CAT20StateLib.loadArtifact(readArtifact('artifacts/cat20/cat20StateLib.json'))
  CAT20Guard_6_6_2.loadArtifact(readArtifact('artifacts/cat20/cat20Guard_6_6_2.json'))
  CAT20Guard_6_6_4.loadArtifact(readArtifact('artifacts/cat20/cat20Guard_6_6_4.json'))
  CAT20Guard_12_12_2.loadArtifact(readArtifact('artifacts/cat20/cat20Guard_12_12_2.json'))
  CAT20Guard_12_12_4.loadArtifact(readArtifact('artifacts/cat20/cat20Guard_12_12_4.json'))
  CAT20GuardStateLib.loadArtifact(readArtifact('artifacts/cat20/cat20GuardStateLib.json'))
}

export async function deployToken(info: OpenMinterCAT20Meta) {
  return deployOpenMinterToken(
    testSigner,
    testSigner,
    testProvider,
    info,
    await testProvider.getFeeRate()
  )
}

export async function mintToken(
  cat20MinterUtxo: UTXO,
  tokenId: string,
  info: OpenMinterCAT20Meta
) {
  const changeAddress = await testSigner.getAddress()
  const tokenReceiverAddr = toTokenOwnerAddress(changeAddress)

  return mintOpenMinterToken(
    testSigner,
    testSigner,
    testProvider,
    cat20MinterUtxo,
    tokenId,
    info,
    tokenReceiverAddr,
    changeAddress,
    await testProvider.getFeeRate()
  )
}

export async function singleSendToken(
  minterScriptHash: string,
  hasAdmin: boolean,
  adminScriptHash: string,
  amount: CAT20_AMOUNT,
  inputTokenUtxos: UTXO[],
  tokenRecieverAddr: ByteString
) {
  const address = await testSigner.getAddress()
  const tokenChangeAddr = toTokenOwnerAddress(address)
  return singleSend(
    testSigner,
    testProvider,
    minterScriptHash,
    inputTokenUtxos,
    [{ address: tokenRecieverAddr, amount }],
    tokenChangeAddr,
    await testProvider.getFeeRate(),
    hasAdmin,
    adminScriptHash
  )
}
