import * as dotenv from 'dotenv';

import { bvmVerify, Covenant, ExtPsbt } from '../../src/index.js';

import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { CSV } from '../contracts/csv.js';
import { readArtifact } from '../utils/index.js';
use(chaiAsPromised);

dotenv.config();

describe('Test CSV', () => {
  before(() => {
    CSV.loadArtifact(readArtifact('csv.json'));
  });

  function testUnlock(sequence) {
    const covenant = Covenant.createCovenant(new CSV()).bindToUtxo({
      txId: 'c1a1a777a52f765ebfa295a35c12280279edd46073d41f4767602f819f574f82',
      outputIndex: 0,
      satoshis: 10000,
    });

    const psbt = new ExtPsbt()
      .addCovenantInput(covenant)
      .setInputSequence(0, sequence)
      .change('bc1pltqlwt7ru0aj6vycyjwea24nlkkltvkk7lwkj5mne5nnzakvn6gq52nf5h', 1)
      .seal();

    psbt
      .updateCovenantInput(0, covenant, {
        invokeMethod: (contract: CSV) => {
          contract.unlock();
        },
      })
      .finalizeAllInputs();

    expect(psbt.isFinalized).to.be.true;
    expect(bvmVerify(psbt, 0)).to.eq(true);
  }

  it('should call `unlock` method successfully.', async () => {
    testUnlock(20);
    testUnlock(222);
  });

  it('should call `unlock` method throw.', async () => {
    expect(() => {
      testUnlock(10);
    }).to.throw();
  });
});
