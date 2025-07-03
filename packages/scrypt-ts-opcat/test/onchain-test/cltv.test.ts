import { use, expect } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import {
  DefaultSigner,
  MempoolProvider,
  UTXO,
  Signer,
  hash160,
  deploy,
  ExtPsbt,
  ChainProvider,
  UtxoProvider,
  call,
  RPCProvider,
  PubKey,
} from '../../src/index.js';
import { getTestKeyPair, network } from '../utils/privateKey.js';
import { createLogger, getDefaultProvider } from '../utils/index.js';
import { CLTV } from '../contracts/cltv.js';

import artifact from '../fixtures/cltv.json' with { type: 'json' };

use(chaiAsPromised);

describe('Test CLTV onchain', () => {
  let signer: Signer;
  let provider: ChainProvider & UtxoProvider;
  let pubKey: string;
  let cltv: CLTV;
  const logger = createLogger('Test CLTV onchain');

  before(async () => {
    CLTV.loadArtifact(artifact);
    signer = new DefaultSigner(getTestKeyPair());
    pubKey = await signer.getPublicKey();
    provider = getDefaultProvider(network)
  });

  it('should deploy successfully', async () => {
    cltv = new CLTV(4150n);
    const psbt = await deploy(signer, provider, cltv);
    expect(psbt.isFinalized).to.be.true;
    logger.info('deployed successfully, txid: ', psbt.extractTransaction().id);
    psbt.getChangeUTXO() && provider.addNewUTXO(psbt.getChangeUTXO()); // add change utxo
  });

  it('should unlock successfully', async () => {
    const psbt = await call(signer, provider, cltv, (cltv) => {
      cltv.unlock();
    });

    expect(psbt.isFinalized).to.be.true;

    const txid = await provider.broadcast(psbt.extractTransaction().toHex());
    logger.info('unlocked successfully, txid: ', txid);
  });
});
