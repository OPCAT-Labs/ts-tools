import {
  ExtPsbt,
  bvmVerify,
  DefaultSigner,
  IExtPsbt,
} from '../../src/index.js';
import { PrivateKey } from '@opcat-labs/opcat';

import { AccessContext } from '../contracts/accessContext.js';

import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { readArtifact } from '../utils/index.js';
use(chaiAsPromised);

describe('Test Contract with verifyContext', () => {
  let accessContext: AccessContext;
  const testSigner = new DefaultSigner(PrivateKey.fromWIF('cQfb2vnBvKryZjG7MuWwDoeMpvHBNAqaNyJH3cNxdHxnHWd6Kv7f'));
  before(() => {
    AccessContext.loadArtifact(readArtifact('accessContext.json'));
    accessContext = new AccessContext();
  });

  it('should call `unlock` method successfully.', async () => {
    accessContext.bindToUtxo({
      txId: 'c1a1a777a52f765ebfa295a35c12280279edd46073d41f4767602f819f574f82',
      outputIndex: 0,
      satoshis: 10000,
      data: '',
    });

    const address = await testSigner.getAddress();
    const psbt = new ExtPsbt({
      network: testSigner.network,
    })
      // add covenant0 and covenant1 to test the context for different inputs
      .addContractInput(accessContext, (accessContext) => {
        accessContext.unlock();
      })
      .change(address, 1)
      .seal();

    expect(async () => {
      await psbt.sign(testSigner)
      expect(bvmVerify(psbt, 0)).to.eq(true);
      expect(bvmVerify(psbt, 1)).to.eq(true);
    }).not.throw();
  });
});
