/* eslint-disable @typescript-eslint/no-unused-expressions */

import { use, expect } from 'chai'
import chaiAsPromised from 'chai-as-promised'
import { testProvider } from './utils/testProvider'
import { testSigner } from './utils/testSigner'
import { ExtPsbt} from '@opcat-labs/scrypt-ts-opcat'
import { isOnchainTest } from './utils'

use(chaiAsPromised)

describe('Test the field `utxo.data`', () => {
  if (!isOnchainTest(testProvider)) {
    console.log('skip utxoData.test.ts for local test')
    return
  }

  it('the node should return the correct data', async () => {
    const address = await testSigner.getAddress()
    const utxos = await testProvider.getUtxos(address)

    const data = '0102030e0f'

    const deployTx = new ExtPsbt({network: await testProvider.getNetwork()})
      .spendUTXO(utxos[0])
      .change(address, await testProvider.getFeeRate())
      .seal()

    const signedDeployTx = await testSigner.signPsbt(deployTx.toHex(), deployTx.psbtOptions())
    deployTx.combine(ExtPsbt.fromHex(signedDeployTx))
    deployTx.finalizeAllInputs()

    await testProvider.broadcast(deployTx.extractTransaction().toHex())
    const newUtxos = await testProvider.getUtxos(address)
    const findUtxo = newUtxos.find((utxo) => utxo.txId === deployTx.extractTransaction().id)
    expect(findUtxo).to.exist
    expect(findUtxo?.data).to.equal(data)
  })
})
