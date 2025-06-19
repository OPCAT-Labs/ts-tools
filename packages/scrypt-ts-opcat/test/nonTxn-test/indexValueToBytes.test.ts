import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
use(chaiAsPromised);

import {
  Covenant,
  StatefulCovenant,
  ChainProvider,
  DummyProvider,
  Signer,
  UtxoProvider,
  call,
  deploy,
} from '../../src/index.js';
import { Counter, CounterStateLib } from '../contracts/counter.js';
import counterArtifact from '../fixtures/counter.json' with { type: 'json' };

import { AccessContext } from '../contracts/accessContext.js';
import accessContextArtifact from '../fixtures/accessContext.json' with { type: 'json' };

import { getTestKeyPair } from '../utils/privateKey.js';
import { DefaultSigner } from 'packages/scrypt-ts-opcat/src/signers/defaultSigner.js';

// input.outpoint.outputIndex
describe('Test indexValueToBytes does not throw by build a tx', () => {
  let signer: Signer;
  let address: string;
  let provider: ChainProvider & UtxoProvider;
  const network = 'opcat-testnet';

  before(async () => {
    signer = new DefaultSigner(await getTestKeyPair(), network);
    address = await signer.getAddress();
    provider = new DummyProvider();
    patchProviderToReturnBigIndex(provider);

    Counter.loadArtifact(counterArtifact);
    CounterStateLib.loadArtifact(counterArtifact);
    AccessContext.loadArtifact(accessContextArtifact);
  });

  describe('should not throw when fee input.outpoint.outputIndex is big while using this.ctx.prevout, this.ctx.prevouts', () => {
    it('test on stateful contract', async () => {
      const counter = new Counter();
      counter.state = { count: -3n };

      const covenant = StatefulCovenant.createCovenant(counter);
      const deployPsbt = await deploy(signer, provider, covenant);
      expect(deployPsbt.isFinalized).to.be.true;

      const newCovenant = covenant.next({ count: covenant.state.count + 1n });

      const callPsbt = await call(
        signer,
        provider,
        covenant,
        {
          invokeMethod: (contract: Counter) => {
            contract.increase();
          },
        },
        { covenant: newCovenant, satoshis: covenant.utxo.satoshis },
      );
      expect(callPsbt.isFinalized).to.be.true;
    });

    it('test on stateless contract', async () => {
      const covenant = Covenant.createCovenant(new AccessContext());
      const deployPsbt = await deploy(signer, provider, covenant);
      expect(deployPsbt.isFinalized).to.be.true;

      const newCovenant = undefined;

      const callPsbt = await call(
        signer,
        provider,
        covenant,
        {
          invokeMethod: (contract: AccessContext) => {
            contract.unlock();
          },
        },
        newCovenant,
      );
      expect(callPsbt.isFinalized).to.be.true;
    });
  });

  function patchProviderToReturnBigIndex(provider: ChainProvider & UtxoProvider) {
    const originGetUtxos = provider.getUtxos;
    provider.getUtxos = async (address, options) => {
      const utxos = await originGetUtxos(address, options);
      const MAX_UINT32 = 0xffffffff;
      utxos[0].outputIndex = MAX_UINT32;
      return utxos;
    };
  }
});
