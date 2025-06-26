import {
  ExtPsbt,
  DefaultSigner,
  Ripemd160,
  bvmVerify,
  sha256,
} from '../../src/index.js';
import { Counter, CounterStateLib } from '../contracts/counter.js';
import { StateMethods } from '../contracts/stateMethods.js';

import counterArtifact from '../fixtures/counter.json' with { type: 'json' };
import stateMethodsArtifact from '../fixtures/stateMethods.json' with { type: 'json' };
import { getDummyUtxo } from '../utils/index.js';
import { use, expect } from 'chai';
import chaiAsPromised from 'chai-as-promised';

use(chaiAsPromised);

describe('Test stateMethods in a stateless contract', () => {
  before(() => {
    Counter.loadArtifact(counterArtifact);
    StateMethods.loadArtifact(stateMethodsArtifact);
    CounterStateLib.loadArtifact(counterArtifact);
  });

  it('should call `unlock` method successfully.', async () => {
    const counter = new Counter();
    counter.state = { count: 1n };
    const stateMethods = new StateMethods();

    const signer = new DefaultSigner();

    const address = await signer.getAddress()
    const deployPsbt = new ExtPsbt()
      .spendUTXO(getDummyUtxo(address))
      .addContractOutput(counter, 1000)
      .addContractOutput(stateMethods, 1000)
      .change(address, 1)
      .seal();

    await deployPsbt.sign(signer);

    const nextCounter = counter.next({ count: 2n });

    const spendPsbt = new ExtPsbt()
      .addContractInput(counter)
      .addContractInput(stateMethods)
      .spendUTXO(getDummyUtxo(address))
      .addContractOutput(nextCounter, 1000)
      .change(address, 1)
      .seal()
      .updateContractInput(0, (contract: Counter) => {
        contract.increase();
      })
      .updateContractInput(1, (contract: StateMethods) => {
        contract.unlock(
          sha256(nextCounter.lockingScript.toHex()),
          1000n,
          Ripemd160(Counter.stateHash(nextCounter.state)),
        );
      });


    await spendPsbt.sign(signer);

    expect(spendPsbt.isFinalized).to.be.true;
    expect(bvmVerify(spendPsbt, 0)).to.be.true;
    expect(bvmVerify(spendPsbt, 1)).to.be.true;
  });
});
