import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
use(chaiAsPromised);

import { DefaultSigner, ExtPsbt } from '../../src/index.js';
import { getDummyUtxo } from '../utils/index.js';

import { Counter, CounterStateLib } from '../contracts/counter.js';
import artifact from '../fixtures/counter.json' with { type: 'json' };

describe('Test Counter', () => {
  let testSigner: DefaultSigner;

  before(() => {
    testSigner = new DefaultSigner();

    Counter.loadArtifact(artifact);
    CounterStateLib.loadArtifact(artifact);
  });

  it('should increment', async () => {
    let counter = await deployCounter();

    for (let i = 0; i < 10; i++) {
      const newContract = await testIncrease(counter);
      counter = newContract;
    }
  });


  async function deployCounter(): Promise<Counter> {
    const counter = new Counter();
    counter.state = { count: -3n };

    const address = await testSigner.getAddress();
    const psbt = new ExtPsbt()
      .spendUTXO(getDummyUtxo(address))
      .addContractOutput(counter,1)
      .change(address, 1)
      .seal();

    await psbt.sign(testSigner);

    expect(psbt.isFinalized).to.be.true;
    return counter;
  }

  async function testIncrease(counter: Counter) : Promise<Counter> {
    const newContract = counter.next({ count: counter.state.count + 1n });
    const address = await testSigner.getAddress();
    const psbt = new ExtPsbt()
      .addContractInput(counter)
      .spendUTXO(getDummyUtxo(address))
      .addContractOutput(newContract, 1)
      .change(address, 1)
      .seal()
      .updateContractInput(0, (contract: Counter) => {
          contract.increase();
        })

    await psbt.sign(testSigner);

    expect(psbt.isFinalized).to.be.true;

    return newContract
  }
});

