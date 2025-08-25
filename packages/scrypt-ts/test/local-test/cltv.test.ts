import * as dotenv from 'dotenv';

import { bvmVerify, DefaultSigner, ExtPsbt } from '@opcat-labs/scrypt-ts';

import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { CLTV } from '../contracts/cltv.js';
import { readArtifact } from '../utils/index.js';
use(chaiAsPromised);

dotenv.config();

describe('Test CLTV', () => {
  let testSigner: DefaultSigner;



  before(() => {
    CLTV.loadArtifact(readArtifact('cltv.json'));
    testSigner = new DefaultSigner();
  });

  async function testUnlock(lockedBlock: bigint) {
    const cltv = new CLTV(400000n)
    cltv.bindToUtxo({
      txId: 'c1a1a777a52f765ebfa295a35c12280279edd46073d41f4767602f819f574f82',
      outputIndex: 0,
      satoshis: 10000,
      data: ''
    });
    const address = await testSigner.getAddress();

    const psbt = new ExtPsbt()
      .addContractInput(cltv, (contract) => {
        contract.unlock();
      })
      .change(address, 1);

    psbt
      // inputSequence should not be default value 0xffffffff
      // https://github.com/bitcoin/bips/blob/master/bip-0065.mediawiki#summary
      .setInputSequence(0, 0xfffffffe)
      .setLocktime(Number(lockedBlock))
      .seal()
      .finalizeAllInputs();

    expect(psbt.isFinalized).to.be.true;
    expect(bvmVerify(psbt, 0)).to.eq(true);
  }

  it('should call `unlock` method successfully.', async () => {
    await testUnlock(400001n);
  });

  it('should call `unlock` method throw.', async () => {
    await expect(testUnlock(100000n)).to.be.rejectedWith(
      'timelock check failed'
    );
  });
});
