import * as dotenv from 'dotenv';
import {
  DefaultSigner,
  hash160,
  ExtPsbt,
  PrivateKey,
  PubKey,
  bvmVerify,
} from '@opcat-labs/scrypt-ts';

import { readArtifact } from '../utils/index.js';
import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { P2PKH } from '../contracts/p2pkh.js';

dotenv.config();

use(chaiAsPromised);

describe('Test P2PKH', () => {
  const testSigner = new DefaultSigner(PrivateKey.fromWIF('cQfb2vnBvKryZjG7MuWwDoeMpvHBNAqaNyJH3cNxdHxnHWd6Kv7f'));
  before(() => {
    P2PKH.loadArtifact(readArtifact('p2pkh.json'));
  });

  it('should call `unlock` method successfully.', async () => {
    const pubKey = await testSigner.getPublicKey();
    const pkh = hash160(pubKey);
    const address = await testSigner.getAddress();
    const c = new P2PKH(pkh);

    c.bindToUtxo({
      txId: 'c1a1a777a52f765ebfa295a35c12280279edd46073d41f4767602f819f574f82',
      outputIndex: 0,
      satoshis: 10000,
      data: ''
    });

    const psbt = new ExtPsbt({network: testSigner.network,})
      .addContractInput(c, (p2pkh, psbt) => {
        const sig = psbt.getSig(0, { address: address });
        p2pkh.unlock(sig, PubKey(pubKey));
      })
      .change(address, 1)
      .seal();

    expect(async () => {
      await psbt.signAndFinalize(testSigner)
      expect(bvmVerify(psbt, 0)).to.eq(true);
    }).not.throw();
  });

  it('should signature check failed', async () => {
    const pubKey = await testSigner.getPublicKey();
    const address = await testSigner.getAddress();
    const pkh = hash160(pubKey);
    const c = new P2PKH(pkh);

    c.bindToUtxo({
      txId: 'c1a1a777a52f765ebfa295a35c12280279edd46073d41f4767602f819f574f82',
      outputIndex: 0,
      satoshis: 10000,
      data: ''
    });

    const wrongSigner = new DefaultSigner();
    const wrongAddress = await wrongSigner.getAddress();

    const psbt = new ExtPsbt()
      .addContractInput(c, (p2pkh, psbt) => {
        const sig = psbt.getSig(0, { address: wrongAddress });
        p2pkh.unlock(sig, PubKey(pubKey));
      })
      .change(address, 1)
      .seal();

    const signedPsbtHex = await wrongSigner.signPsbt(psbt.toHex(), {
      autoFinalized: false,
      toSignInputs: [
        {
          address: wrongAddress,
          index: 0,
        },
      ],
    });

    expect(() => {
      psbt.combine(ExtPsbt.fromHex(signedPsbtHex)).finalizeAllInputs();
    }).to.throw(/signature check failed/);
  });
});
