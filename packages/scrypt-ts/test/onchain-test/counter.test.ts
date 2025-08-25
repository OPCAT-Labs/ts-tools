import { Counter, CounterStateLib } from '../contracts/counter.js';
import counterArtifact from '../fixtures/counter.json' with { type: 'json' };
import { network } from '../utils/privateKey.js';
import {
  Signer,
  deploy,
  call,
  ChainProvider,
  UtxoProvider,
} from '@opcat-labs/scrypt-ts';
import { createLogger, getDefaultProvider, getDefaultSigner } from '../utils/index.js';
import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
use(chaiAsPromised);

describe('Test Counter onchain', () => {
  let signer: Signer;
  let provider: ChainProvider & UtxoProvider;
  let counter: Counter
  const logger = createLogger('Test Counter onchain');

  before(async () => {
    Counter.loadArtifact(counterArtifact);
    CounterStateLib.loadArtifact(counterArtifact);
    signer = getDefaultSigner()
    provider = getDefaultProvider(network)
  });

  it('should deploy successfully', async () => {
    counter = new Counter();
    counter.state = { count: 0n };
    const psbt = await deploy(signer, provider, counter);
    expect(psbt.isFinalized).to.be.true;
    logger.info('deployed successfully, txid: ', psbt.extractTransaction().id);
    psbt.getChangeUTXO() && provider.addNewUTXO(psbt.getChangeUTXO()); // add change utxo
  });

  it('should increase', async () => {

    for (let i = 0; i < 2; i++) {
      const newContract = counter.next({ count: counter.state.count + 1n });
      const psbt = await call(
        signer,
        provider,
        counter,
        (contract: Counter) => {
          contract.increase();
        },
        { contract: newContract, satoshis: 1 },
      );
  
      expect(psbt.isFinalized).to.be.true;
  
      const txid = psbt.extractTransaction().id;
      logger.info('increased successfully, txid: ', txid);

      counter = newContract
    }
  });
});
