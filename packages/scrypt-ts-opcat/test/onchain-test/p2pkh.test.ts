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
} from '../../src/index.js';
import { getTestKeyPair, network } from '../utils/privateKey.js';
import { createLogger, delay } from '../utils/index.js';
import { P2PKH } from '../contracts/p2pkh.js';

import artifact from '../fixtures/p2pkh.json' with { type: 'json' };

use(chaiAsPromised);

describe('Test P2PKH onchain', () => {
  let signer: Signer;
  let provider: ChainProvider & UtxoProvider;
  let pubKey: string;
  const logger = createLogger('Test P2PKH onchain');

  before(async () => {
    P2PKH.loadArtifact(artifact);
    signer = new DefaultSigner(getTestKeyPair());
    pubKey = await signer.getPublicKey();
    provider = new RPCProvider(network, "http://157.245.154.198:18443", "wallet.dat", "scrypt", "Passw0rd!");
  });

  it('should deploy successfully', async () => {
    const p2pkh = new P2PKH(hash160(pubKey));
    const psbt = await deploy(signer, provider, p2pkh);
    expect(psbt.isFinalized).to.be.true;
    logger.info('deployed successfully, txid: ', psbt.extractTransaction().id);
    psbt.getChangeUTXO() && provider.addNewUTXO(psbt.getChangeUTXO()); // add change utxo
  });

  // it('should unlock successfully', async () => {
  //   const address = await signer.getAddress();
  //   const psbt = await call(signer, provider, covenant, {
  //     invokeMethod: (p2pkh: P2PKH, psbt: ExtPsbt) => {
  //       p2pkh.unlock(psbt.getSig(0, { address: address }), xOnlyPubKey);
  //     },
  //   });
  //   expect(psbt.isFinalized).to.be.true;

  //   const txid = await provider.broadcast(psbt.extractTransaction().toHex());
  //   logger.info('unlocked successfully, txid: ', txid);
  // });
});
