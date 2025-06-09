import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
use(chaiAsPromised);

import { StatefulCovenant } from '../../src/covenant.js';
import { ExtPsbt, uint8ArrayToHex } from '../../src/index.js';
import { getDummyUtxo } from '../utils/index.js';

import { Counter, CounterStateLib } from '../contracts/counter.js';
import artifact from '../fixtures/counter.json' with { type: 'json' };
import { CounterState } from '../contracts/counterState.js';
import { testKeyPair, testTweakedKeyPair } from '../utils/privateKey.js';

describe('Test Counter', () => {
  before(() => {
    Counter.loadArtifact(artifact);
    CounterStateLib.loadArtifact(artifact);
  });

  it('should increment', async () => {
    let { covenant } = await deployCounter();

    for (let i = 0; i < 5; i++) {
      const { covenant: newCovenant } = await testIncrease(covenant);
      covenant = newCovenant;
    }
  });
});

async function deployCounter() {
  const counter = new Counter();
  counter.state = { count: -3n };

  const covenant = StatefulCovenant.createCovenant(counter);

  const psbt = new ExtPsbt()
    .spendUTXO(await getDummyUtxo())
    .addCovenantOutput(covenant, 1000)
    .change('bc1pltqlwt7ru0aj6vycyjwea24nlkkltvkk7lwkj5mne5nnzakvn6gq52nf5h', 1)
    .seal();

  covenant.bindToUtxo({
    txId: psbt.unsignedTx.getId(),
    outputIndex: 1,
    satoshis: 1000,
    txoStateHashes: psbt.getTxoStateHashes(),
    txHashPreimage: uint8ArrayToHex(psbt.unsignedTx.toBuffer(undefined, 0, false)),
  });

  return {
    covenant,
    psbt,
  };
}

async function testIncrease(covenant: StatefulCovenant<CounterState>) {
  const newCovenant = covenant.next({ count: covenant.state.count + 1n });

  const psbt = new ExtPsbt()
    .addCovenantInput(covenant)
    .spendUTXO(await getDummyUtxo())
    .addCovenantOutput(newCovenant, 1000)
    .change('bc1pltqlwt7ru0aj6vycyjwea24nlkkltvkk7lwkj5mne5nnzakvn6gq52nf5h', 1)
    .seal()
    .updateCovenantInput(0, covenant, {
      invokeMethod: (contract: Counter) => {
        contract.increase();
      },
    })
    .updateInput(1, {
      tapInternalKey: testKeyPair.publicKey.slice(1, 33),
    })
    .signTaprootInput(1, testTweakedKeyPair)
    .finalizeAllInputs();

  expect(psbt.isFinalized).to.be.true;

  return {
    covenant: newCovenant,
    psbt: psbt,
  };
}
