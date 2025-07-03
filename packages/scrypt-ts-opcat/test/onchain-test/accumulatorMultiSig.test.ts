import chaiAsPromised from 'chai-as-promised';

import { AccumulatorMultiSig } from '../contracts/accumulatorMultiSig.js';
import { createLogger, getDefaultProvider, readArtifact } from '../utils/index.js';
import { hash160 } from '../../src/smart-contract/fns/index.js';
import {
  ChainProvider,
  DefaultSigner,
  IExtPsbt,
  MempoolProvider,
  PubKey,
  Sig,
  Signer,
  UtxoProvider,
  call,
  deploy,
} from '../../src/index.js';
import { getTestKeyPair, network } from '../utils/privateKey.js';

describe('Test SmartContract `AccumulatorMultiSig`', () => {
  let signer: Signer;
  let provider: ChainProvider & UtxoProvider;
  const logger = createLogger('Test AccumulatorMultiSig onchain');
  before(() => {
    AccumulatorMultiSig.loadArtifact(readArtifact('accumulatorMultiSig.json'));
    signer = new DefaultSigner(getTestKeyPair());
    provider = getDefaultProvider(network)
  });

  it('should successfully with all three right.', async () => {
    const address1 = await signer.getAddress();
    const publicKey1 = await signer.getPublicKey();
    const pkh1 = hash160(publicKey1);

    const address2 = await signer.getAddress();
    const publicKey2 = await signer.getPublicKey();
    const pkh2 = hash160(publicKey2);

    const address3 = await signer.getAddress();
    const publicKey3 = await signer.getPublicKey();
    const pkh3 = hash160(publicKey3);

    const threshold = BigInt(AccumulatorMultiSig.N);
    const c = new AccumulatorMultiSig(threshold, [pkh1, pkh2, pkh3]);
    const psbt = await deploy(signer, provider, c);

    logger.info('deployed successfully, txid: ', psbt.extractTransaction().id);
    psbt.getChangeUTXO() && provider.addNewUTXO(psbt.getChangeUTXO()); // add change utxo

    const callPsbt = await call(signer, provider, c, (accumulatorMultiSig: AccumulatorMultiSig, psbt: IExtPsbt) => {
      const sig1 = psbt.getSig(0, { address: address1 });
      accumulatorMultiSig.main(
        [PubKey(publicKey1), PubKey(publicKey2), PubKey(publicKey3)],
        [sig1, sig1, sig1],
        [true, true, true],
      );
    });

    logger.info('called successfully, txid: ', callPsbt.extractTransaction().id);
  });
});
