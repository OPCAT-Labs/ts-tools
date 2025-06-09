import * as dotenv from 'dotenv';

import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { Demo } from '../contracts/demo.js';
import { readArtifact } from '../utils/index.js';
import { Covenant, ExtPsbt, bvmVerify } from '../../src/index.js';
use(chaiAsPromised);

dotenv.config();

describe('Test Demo', () => {
  before(() => {
    Demo.loadArtifact(readArtifact('demo.json'));
  });

  function testAdd(x: bigint, y: bigint) {
    const covenant = Covenant.createCovenant(new Demo(x, y)).bindToUtxo({
      txId: 'c1a1a777a52f765ebfa295a35c12280279edd46073d41f4767602f819f574f82',
      outputIndex: 0,
      satoshis: 10000,
    });

    const psbt = new ExtPsbt()
      .addCovenantInput(covenant)
      .change('bc1pltqlwt7ru0aj6vycyjwea24nlkkltvkk7lwkj5mne5nnzakvn6gq52nf5h', 1)
      .seal();

    psbt
      .updateCovenantInput(0, covenant, {
        invokeMethod: (contract: Demo) => {
          contract.add(x + y);
        },
      })
      .finalizeAllInputs();

    expect(psbt.isFinalized).to.be.true;
  }

  function testSub(x: bigint, y: bigint) {
    const covenant = Covenant.createCovenant(new Demo(x, y)).bindToUtxo({
      txId: 'c1a1a777a52f765ebfa295a35c12280279edd46073d41f4767602f819f574f82',
      outputIndex: 0,
      satoshis: 10000,
    });

    const psbt = new ExtPsbt()
      .addCovenantInput(covenant)
      .change('bc1pltqlwt7ru0aj6vycyjwea24nlkkltvkk7lwkj5mne5nnzakvn6gq52nf5h', 1)
      .seal();

    psbt
      .updateCovenantInput(0, covenant, {
        invokeMethod: (contract: Demo) => {
          contract.sub(x - y);
        },
      })
      .finalizeAllInputs();

    expect(psbt.isFinalized).to.be.true;
    expect(bvmVerify(psbt, 0)).to.eq(true);
  }

  it('should call `unlock` method successfully.', async () => {
    testAdd(8925n, 8925n);
    testAdd(0n, 0n);
    testAdd(1n, 1n);
    testAdd(2n, 16n);
    testAdd(-1n, 16n);
    testAdd(-1n, -1n);
    testAdd(0n, -1n);
    testAdd(1n, -1n);

    testSub(8925n, 8925n);
    testSub(0n, 0n);
    testSub(1n, 1n);
    testSub(2n, 16n);
    testSub(-1n, 16n);
    testSub(-1n, -1n);
    testSub(0n, 1n);
  });
});
