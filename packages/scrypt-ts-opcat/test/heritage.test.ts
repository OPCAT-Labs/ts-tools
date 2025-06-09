import * as dotenv from 'dotenv';

import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { Demo } from './contracts/demo.js';
import { HeritageDemo } from './contracts/heritage.js';
import { readArtifact } from './utils/index.js';
import { Covenant, ExtPsbt, bvmVerify } from '../src/index.js';
use(chaiAsPromised);

dotenv.config();

describe('Test Heritage', () => {
  before(() => {
    Demo.loadArtifact(readArtifact('demo.json'));
    HeritageDemo.loadArtifact(readArtifact('heritageDemo.json'));
  });

  it('create heritage demo instance by `new` should throw error', () => {
    expect(() => new HeritageDemo(1n, 2n)).to.throw(Error);
  });

  it('create heritage demo instance by `create` should not throw error', () => {
    expect(() => HeritageDemo.create(1n, 2n)).not.to.throw(Error);
  });

  it('should call `add` method in parent class successfully.', async () => {
    const covenant = Covenant.createCovenant(Demo.create(1n, 2n)).bindToUtxo({
      txId: 'c1a1a777a52f765ebfa295a35c12280279edd46073d41f4767602f819f574f82',
      outputIndex: 0,
      satoshis: 10000,
    });

    const psbt = new ExtPsbt()
      .addCovenantInput(covenant)
      .change('bc1pltqlwt7ru0aj6vycyjwea24nlkkltvkk7lwkj5mne5nnzakvn6gq52nf5h', 1);

    psbt.updateCovenantInput(0, covenant, {
      invokeMethod: (contract: HeritageDemo) => {
        contract.add(3n);
      },
    });

    psbt.finalizeAllInputs();
    expect(psbt.isFinalized).to.be.true;
  });

  it('should call `add` method in child class successfully.', async () => {
    const covenant = Covenant.createCovenant(HeritageDemo.create(1n, 2n)).bindToUtxo({
      txId: 'c1a1a777a52f765ebfa295a35c12280279edd46073d41f4767602f819f574f82',
      outputIndex: 0,
      satoshis: 10000,
    });

    const psbt = new ExtPsbt()
      .addCovenantInput(covenant)
      .change('bc1pltqlwt7ru0aj6vycyjwea24nlkkltvkk7lwkj5mne5nnzakvn6gq52nf5h', 1);

    psbt.updateCovenantInput(0, covenant, {
      invokeMethod: (contract: HeritageDemo) => {
        contract.add(3n);
      },
    });

    psbt.finalizeAllInputs();
    expect(psbt.isFinalized).to.be.true;
  });

  it('should call `unlock` method in child class successfully.', async () => {
    const covenant = Covenant.createCovenant(HeritageDemo.create(1n, 2n)).bindToUtxo({
      txId: 'c1a1a777a52f765ebfa295a35c12280279edd46073d41f4767602f819f574f82',
      outputIndex: 0,
      satoshis: 10000,
    });

    const psbt = new ExtPsbt()
      .addCovenantInput(covenant)
      .change('bc1pltqlwt7ru0aj6vycyjwea24nlkkltvkk7lwkj5mne5nnzakvn6gq52nf5h', 1);

    psbt.updateCovenantInput(0, covenant, {
      invokeMethod: (contract: HeritageDemo) => {
        contract.unlock(4n);
      },
    });

    psbt.finalizeAllInputs();
    expect(psbt.isFinalized).to.be.true;
  });
});
