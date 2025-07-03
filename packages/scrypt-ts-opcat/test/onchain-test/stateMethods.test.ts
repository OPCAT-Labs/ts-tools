import {
  ExtPsbt,
  DefaultSigner,
  Ripemd160,
  bvmVerify,
  sha256,
  MempoolProvider,
  markSpent,
} from '../../src/index.js';
import { Counter, CounterStateLib } from '../contracts/counter.js';
import { StateMethods } from '../contracts/stateMethods.js';

import counterArtifact from '../fixtures/counter.json' with { type: 'json' };
import stateMethodsArtifact from '../fixtures/stateMethods.json' with { type: 'json' };
import { createLogger, getDummyUtxo, getDefaultProvider } from '../utils/index.js';
import { use, expect } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { getTestKeyPair, network } from '../utils/privateKey.js';

use(chaiAsPromised);

describe('Test stateMethods in a stateless contract', () => {

  const logger = createLogger('Test stateMethods onchain');

  before(() => {
    Counter.loadArtifact(counterArtifact);
    StateMethods.loadArtifact(stateMethodsArtifact);
    CounterStateLib.loadArtifact(counterArtifact);
  });

  it('should call `unlock` method successfully.', async () => {
    const counter = new Counter();
    counter.state = { count: 1n };
    const stateMethods = new StateMethods();

    const signer = new DefaultSigner(getTestKeyPair());

    const provider = getDefaultProvider(network)

    const address = await signer.getAddress()
    const utxos = await provider.getUtxos(address);

    const deployPsbt = new ExtPsbt()
      .spendUTXO(utxos)
      .addContractOutput(counter, 1)
      .addContractOutput(stateMethods, 1)
      .change(address, 1)
      .seal();

    await deployPsbt.sign(signer);
    const deployTx = deployPsbt.extractTransaction();
    const deployTxId = await provider.broadcast(deployTx.toHex());
    logger.info('deployed successfully, txid: ', deployTxId);
    markSpent(provider, deployTx);
    const nextCounter = counter.next({ count: 2n });

    const spendPsbt = new ExtPsbt()
      .addContractInput(counter, (contract) => {
        contract.increase();
      })
      .addContractInput(stateMethods, (contract) => {
        contract.unlock(
          sha256(nextCounter.lockingScript.toHex()),
          1n,
          Ripemd160(Counter.stateHash(nextCounter.state)),
        );
      })
      .spendUTXO(deployPsbt.getChangeUTXO())
      .addContractOutput(nextCounter, 1)
      .change(address, 10)
      .seal()

    await spendPsbt.sign(signer);

    const callTx = spendPsbt.extractTransaction();
    const callTxId = await provider.broadcast(callTx.toHex());
    logger.info('called successfully, txid: ', callTxId);
  });
});
