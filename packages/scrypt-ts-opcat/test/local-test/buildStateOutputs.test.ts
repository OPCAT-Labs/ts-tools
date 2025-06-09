import {
  Covenant,
  StatefulCovenant,
  ExtPsbt,
  hash160,
  DefaultSigner,
  TxUtils,
  Ripemd160,
  bvmVerify,
} from '../../src/index.js';
import { Counter, CounterStateLib } from '../contracts/counter.js';
import { StateMethods } from '../contracts/stateMethods.js';
import { getTestKeyPair, network } from '../utils/privateKey.js';

import counterArtifact from '../fixtures/counter.json' with { type: 'json' };
import stateMethodsArtifact from '../fixtures/stateMethods.json' with { type: 'json' };
import { getDummyUtxo } from '../utils/index.js';
import { use, expect } from 'chai';
import chaiAsPromised from 'chai-as-promised';

use(chaiAsPromised);

describe('Test buildStateOutputs/appendStateOutput in a stateless contract', () => {
  before(() => {
    Counter.loadArtifact(counterArtifact);
    StateMethods.loadArtifact(stateMethodsArtifact);
    CounterStateLib.loadArtifact(counterArtifact);
  });

  it('should call `unlock` method successfully.', async () => {
    const counter = new Counter();
    counter.state = { count: 1n };

    const signer = new DefaultSigner(await getTestKeyPair(), network);
    const stateMethods = new StateMethods();

    const counterCovenant = StatefulCovenant.createCovenant(counter);
    const stateMethodsCovenant = Covenant.createCovenant(stateMethods);

    const deployPsbt = new ExtPsbt()
      .spendUTXO(await getDummyUtxo(await signer.getAddress()))
      .addCovenantOutput(counterCovenant, 1000)
      .addCovenantOutput(stateMethodsCovenant, 1000)
      .change('bc1pltqlwt7ru0aj6vycyjwea24nlkkltvkk7lwkj5mne5nnzakvn6gq52nf5h', 1)
      .seal();
    const signedDeployPsbt = await signer.signPsbt(deployPsbt.toHex(), deployPsbt.psbtOptions());
    deployPsbt.combine(ExtPsbt.fromHex(signedDeployPsbt)).finalizeAllInputs();

    const nextCounterCovenant = counterCovenant.next({ count: 2n });

    const spendPsbt = new ExtPsbt()
      .addCovenantInput(counterCovenant)
      .addCovenantInput(stateMethodsCovenant)
      .spendUTXO(await getDummyUtxo())
      .addCovenantOutput(nextCounterCovenant, 1000)
      .change('bc1pltqlwt7ru0aj6vycyjwea24nlkkltvkk7lwkj5mne5nnzakvn6gq52nf5h', 1)
      .seal()
      .updateCovenantInput(0, counterCovenant, {
        invokeMethod: (contract: Counter) => {
          contract.increase();
        },
      })
      .updateCovenantInput(1, stateMethodsCovenant, {
        invokeMethod: (contract: StateMethods) => {
          contract.unlock(
            nextCounterCovenant.lockingScriptHex,
            TxUtils.toSatoshis(1000n),
            Ripemd160(nextCounterCovenant.stateHash),
          );
        },
      });

    const signedSpendPsbt = await signer.signPsbt(spendPsbt.toHex(), spendPsbt.psbtOptions());
    spendPsbt.combine(ExtPsbt.fromHex(signedSpendPsbt)).finalizeAllInputs();

    expect(spendPsbt.isFinalized).to.be.true;
    expect(bvmVerify(spendPsbt, 0)).to.be.true;
    expect(bvmVerify(spendPsbt, 1)).to.be.true;
  });
});
