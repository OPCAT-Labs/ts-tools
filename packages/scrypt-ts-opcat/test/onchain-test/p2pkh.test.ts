import { use, expect } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import {
  DefaultSigner,
  MempoolProvider,
  UTXO,
  Signer,
  Covenant,
  toXOnly,
  PubKey,
  hash160,
  deploy,
  ExtPsbt,
  ChainProvider,
  UtxoProvider,
  call,
} from '../../src/index.js';
import { getTestKeyPair, network } from '../utils/privateKey.js';
import { createLogger, delay } from '../utils/index.js';
import { P2PKH } from '../contracts/p2pkh.js';

import artifact from '../fixtures/p2pkh.json' with { type: 'json' };

use(chaiAsPromised);

describe('Test P2PKH onchain', () => {
  let signer: Signer;
  let provider: ChainProvider & UtxoProvider;
  let covenant: Covenant;
  let pubKey: PubKey;
  let xOnlyPubKey: PubKey;
  const logger = createLogger('Test P2PKH onchain');

  before(async () => {
    P2PKH.loadArtifact(artifact);
    signer = new DefaultSigner(await getTestKeyPair(), network);
    pubKey = PubKey(await signer.getPublicKey());
    xOnlyPubKey = PubKey(toXOnly(pubKey, true));
    provider = new MempoolProvider(network);
  });

  it('should deploy successfully', async () => {
    await delay(3000); // delay for avoid txn-mempool-conflict
    const p2pkh = new P2PKH(hash160(xOnlyPubKey));
    covenant = Covenant.createCovenant(p2pkh, { network: network });
    const psbt = await deploy(signer, provider, covenant);
    expect(psbt.isFinalized).to.be.true;
    logger.info('deployed successfully, txid: ', psbt.extractTransaction().getId());
    psbt.getChangeUTXO() && provider.addNewUTXO(psbt.getChangeUTXO()); // add change utxo
  });

  it('should unlock successfully', async () => {
    const address = await signer.getAddress();
    const psbt = await call(signer, provider, covenant, {
      invokeMethod: (p2pkh: P2PKH, psbt: ExtPsbt) => {
        p2pkh.unlock(psbt.getSig(0, { address: address }), xOnlyPubKey);
      },
    });
    expect(psbt.isFinalized).to.be.true;

    const txid = await provider.broadcast(psbt.extractTransaction().toHex());
    logger.info('unlocked successfully, txid: ', txid);
  });
});
