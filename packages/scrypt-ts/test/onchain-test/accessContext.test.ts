import { use, expect } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import {
  DefaultSigner,
  Signer,
  deploy,
  ExtPsbt,
  ChainProvider,
  UtxoProvider,
  call,
} from '@opcat-labs/scrypt-ts';
import { getTestKeyPair, network } from '../utils/privateKey.js';
import { createLogger, getDefaultProvider } from '../utils/index.js';
import artifact from '../fixtures/accessContext.json' with { type: 'json' };
import { AccessContext } from '../contracts/accessContext.js';

use(chaiAsPromised);

describe('Test AccessContext onchain', () => {
  let signer: Signer;
  let provider: ChainProvider & UtxoProvider;
  let pubKey: string;
  let accessContext: AccessContext;
  const logger = createLogger('Test AccessContext onchain');

  before(async () => {
    AccessContext.loadArtifact(artifact);
    signer = new DefaultSigner(getTestKeyPair());
    pubKey = await signer.getPublicKey();
    provider = getDefaultProvider(network)
  });

  it('should deploy successfully', async () => {
    accessContext = new AccessContext();
    const psbt = await deploy(signer, provider, accessContext);
    expect(psbt.isFinalized).to.be.true;
    logger.info('deployed successfully, txid: ', psbt.extractTransaction().id);
    psbt.getChangeUTXO() && provider.addNewUTXO(psbt.getChangeUTXO()); // add change utxo
  });

  it('should unlock successfully', async () => {
    const psbt = await call(signer, provider, accessContext, (accessContext: AccessContext, psbt: ExtPsbt) => {
      accessContext.unlock();
    });
    expect(psbt.isFinalized).to.be.true;

    const txid = await provider.broadcast(psbt.extractTransaction().toHex());
    logger.info('unlocked successfully, txid: ', txid);
  });
});
