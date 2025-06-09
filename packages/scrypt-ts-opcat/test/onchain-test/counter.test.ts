import { Counter, CounterStateLib } from '../contracts/counter.js';
import counterArtifact from '../fixtures/counter.json' with { type: 'json' };
import { getTestKeyPair, network } from '../utils/privateKey.js';
import {
  MempoolProvider,
  DefaultSigner,
  Signer,
  deploy,
  StatefulCovenant,
  call,
  ChainProvider,
  UtxoProvider,
} from '../../src/index.js';
import { createLogger, delay } from '../utils/index.js';
import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { CounterState } from '../contracts/counterState.js';
use(chaiAsPromised);

describe('Test Counter onchain', () => {
  let signer: Signer;
  let provider: ChainProvider & UtxoProvider;
  let counterCovenant: StatefulCovenant<CounterState>;
  const logger = createLogger('Test Counter onchain');

  before(async () => {
    Counter.loadArtifact(counterArtifact);
    CounterStateLib.loadArtifact(counterArtifact);
    signer = new DefaultSigner(await getTestKeyPair(), network);
    provider = new MempoolProvider(network);
  });

  it('should deploy successfully', async () => {
    await delay(3000); // delay for avoid txn-mempool-conflict
    const counter = new Counter();
    counter.state = { count: -3n };
    counterCovenant = StatefulCovenant.createCovenant(counter, { network: network });
    const psbt = await deploy(signer, provider, counterCovenant);
    expect(psbt.isFinalized).to.be.true;
    logger.info('deployed successfully, txid: ', psbt.extractTransaction().getId());
    psbt.getChangeUTXO() && provider.addNewUTXO(psbt.getChangeUTXO()); // add change utxo
  });

  it('should increase', async () => {
    const newCovenant = counterCovenant.next({ count: counterCovenant.state.count + 1n });
    const psbt = await call(
      signer,
      provider,
      counterCovenant,
      {
        invokeMethod: (contract: Counter) => {
          contract.increase();
        },
      },
      { covenant: newCovenant, satoshis: counterCovenant.utxo.satoshis },
    );

    expect(psbt.isFinalized).to.be.true;

    const txid = await provider.broadcast(psbt.extractTransaction().toHex());
    logger.info('increased successfully, txid: ', txid);
  });
});
