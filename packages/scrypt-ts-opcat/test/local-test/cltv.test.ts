import * as dotenv from 'dotenv';

import { bvmVerify, Covenant, ExtPsbt } from '../../src/index.js';

import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { CLTV } from '../contracts/cltv.js';
import { readArtifact } from '../utils/index.js';
use(chaiAsPromised);

dotenv.config();

describe('Test CLTV', () => {
  before(() => {
    CLTV.loadArtifact(readArtifact('cltv.json'));
  });

  function testUnlock(lockTime: number) {
    const covenant = Covenant.createCovenant(new CLTV()).bindToUtxo({
      txId: 'c1a1a777a52f765ebfa295a35c12280279edd46073d41f4767602f819f574f82',
      outputIndex: 0,
      satoshis: 10000,
    });

    const psbt = new ExtPsbt()
      .addCovenantInput(covenant)
      .change('bc1pltqlwt7ru0aj6vycyjwea24nlkkltvkk7lwkj5mne5nnzakvn6gq52nf5h', 1);

    psbt
      // inputSequence should not be default value 0xffffffff
      // https://github.com/bitcoin/bips/blob/master/bip-0065.mediawiki#summary
      .setInputSequence(0, 0xfffffffe)
      .setLocktime(lockTime)
      .seal()
      .updateCovenantInput(0, covenant, {
        invokeMethod: (contract: CLTV) => {
          contract.unlock();
        },
      })
      .finalizeAllInputs();

    expect(psbt.isFinalized).to.be.true;
    expect(bvmVerify(psbt, 0)).to.eq(true);
  }

  it('should call `unlock` method successfully.', async () => {
    testUnlock(400001);
  });

  it('should call `unlock` method throw.', async () => {
    expect(() => {
      testUnlock(100000);
    }).to.throw();
  });
});
