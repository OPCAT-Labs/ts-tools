import { expect, use } from 'chai'
import { Counter, CounterState } from '../src/contracts/counter'
import { ExtPsbt, UTXO } from '@opcat-labs/scrypt-ts'
import chaiAsPromised from 'chai-as-promised'
import { testSigner } from './utils/testSigner'
import { testProvider } from './utils/testProvider'
import { verifyTx } from './utils/index'
import counterArtifact from '../artifacts/counter.json'
use(chaiAsPromised)

describe('Test SmartContract `Counter`', () => {
  before(async () => {
    Counter.loadArtifact(counterArtifact)
  })

  it('should pass the public method unit test successfully.', async () => {
    const counter = new Counter()

    let state = { count: 0n }
    const feeUtxos = await testProvider.getUtxos(await testSigner.getAddress())

    counter.state = state;
    const deployTx = new ExtPsbt({network: await testProvider.getNetwork()})
      .spendUTXO(feeUtxos)
      .addContractOutput(counter, 500)
      .change(await testSigner.getAddress(), await testProvider.getFeeRate())
      .seal()

    const signedDeployTx = await testSigner.signPsbt(deployTx.toHex(), deployTx.psbtOptions())
    deployTx.combine(ExtPsbt.fromHex(signedDeployTx))
    deployTx.finalizeAllInputs()
    verifyTx(deployTx, expect)
    await testProvider.broadcast(deployTx.extractTransaction().toHex())

    let utxo = deployTx.getUtxo(0)
    let feeUtxo = deployTx.getChangeUTXO()!

    for (let i = 0; i < 2; i++) {
      const result = await testIncrease(counter, state, utxo, feeUtxo)
      utxo = result.utxo
      feeUtxo = result.feeUtxo
      state = result.state
    }
  })

  async function testIncrease(
    contract: Counter,
    state: CounterState,
    utxo: UTXO,
    feeUtxo: UTXO
  ) {


    const nextState = {
      count: state.count + 1n,
    }
    const nextContract = contract.next(nextState)

    contract.bindToUtxo(utxo);
    contract.state = state;
    const tx = new ExtPsbt({network: await testProvider.getNetwork()})
      .addContractInput(contract, (contract) => {
        contract.increase()
      })
      .spendUTXO(feeUtxo)
      .addContractOutput(
        nextContract,
        utxo.satoshis,
      )
      .change(await testSigner.getAddress(), await testProvider.getFeeRate())
      .seal()

    const signedTx = await testSigner.signPsbt(tx.toHex(), tx.psbtOptions())
    tx.combine(ExtPsbt.fromHex(signedTx))
    tx.finalizeAllInputs()

    verifyTx(tx, expect)

    await testProvider.broadcast(tx.extractTransaction().toHex())

    const nextUtxo = tx.getUtxo(0)

    return {
      contract: nextContract,
      state: nextState,
      utxo: nextUtxo,
      feeUtxo: tx.getChangeUTXO()!,
    }
  }
})
