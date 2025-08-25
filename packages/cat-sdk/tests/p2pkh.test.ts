import { use, expect } from 'chai'
import { hash160, PubKey } from '@opcat-labs/scrypt-ts'
import { P2PKH } from '../src/contracts/p2pkh'
import { ExtPsbt } from '@opcat-labs/scrypt-ts'
import chaiAsPromised from 'chai-as-promised'
import { testSigner } from './utils/testSigner'
import { testProvider } from './utils/testProvider'
import { verifyTx } from './utils/index'
import p2pkhArtifact from '../artifacts/p2pkh.json'
use(chaiAsPromised)

describe('Test SmartContract `P2PKH`', () => {
  before(async () => {
    P2PKH.loadArtifact(p2pkhArtifact)
  })

  it('should pass the public method unit test successfully.', async () => {
    const address = await testSigner.getAddress()
    const pubKey = await testSigner.getPublicKey()
    const p2pkh = new P2PKH(hash160(pubKey))
    const feeUtxos = await testProvider.getUtxos(address)

    const deployTx = new ExtPsbt({network: await testProvider.getNetwork()})
      .spendUTXO(feeUtxos)
      .addContractOutput(p2pkh, 600)
      .change(await testSigner.getAddress(), await testProvider.getFeeRate())
      .seal()

    const signedDeployTx = await testSigner.signPsbt(deployTx.toHex(), deployTx.psbtOptions())
    deployTx.combine(ExtPsbt.fromHex(signedDeployTx))
    deployTx.finalizeAllInputs()
    verifyTx(deployTx, expect)
    await testProvider.broadcast(deployTx.extractTransaction().toHex())

    const utxo = deployTx.getUtxo(0)
    const feeUtxo = deployTx.getChangeUTXO()!

    p2pkh.bindToUtxo(utxo);
    const tx = new ExtPsbt({network: await testProvider.getNetwork()})
      .addContractInput(p2pkh, (contract, tx) => {
          const sig = tx.getSig(0, {
            publicKey: pubKey,
          })
          contract.unlock(sig, PubKey(pubKey))
      })
      .spendUTXO(feeUtxo)
      .change(await testSigner.getAddress(), await testProvider.getFeeRate())
      .seal()

    const signedTx = await testSigner.signPsbt(tx.toHex(), tx.psbtOptions())
    tx.combine(ExtPsbt.fromHex(signedTx))
    tx.finalizeAllInputs()
    verifyTx(tx, expect)

    await testProvider.broadcast(tx.extractTransaction().toHex())
  })
})
