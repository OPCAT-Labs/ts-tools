import { use, expect } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import {
  Signer,
  deploy,
  ExtPsbt,
  ChainProvider,
  UtxoProvider,
  call,
} from '@opcat-labs/scrypt-ts-opcat';
import { network } from '../utils/privateKey.js';
import { createLogger, getDefaultProvider, getDefaultSigner } from '../utils/index.js';
import { Demo } from '../contracts/demo.js';

import artifact from '../fixtures/demo.json' with { type: 'json' };

use(chaiAsPromised);

describe('Test Demo onchain', () => {
  let signer: Signer;
  let provider: ChainProvider & UtxoProvider;
  let pubKey: string;
  let demo: Demo;
  const logger = createLogger('Test Demo onchain');

  before(async () => {
    Demo.loadArtifact(artifact);
    signer = getDefaultSigner()
    pubKey = await signer.getPublicKey();
    provider = getDefaultProvider(network)
  });

  it('should deploy successfully', async () => {
    demo = new Demo(1n, 2n);
    const psbt = await deploy(signer, provider, demo);
    expect(psbt.isFinalized).to.be.true;
    logger.info('deployed successfully, txid: ', psbt.extractTransaction().id);
    psbt.getChangeUTXO() && provider.addNewUTXO(psbt.getChangeUTXO()); // add change utxo
  });

  it('should unlock successfully', async () => {
    const psbt = await call(signer, provider, demo, (demo: Demo, psbt: ExtPsbt) => {
      demo.add(3n);
    });
    expect(psbt.isFinalized).to.be.true;

    const txid = await provider.broadcast(psbt.extractTransaction().toHex());
    logger.info('unlocked successfully, txid: ', txid);
  });
});
