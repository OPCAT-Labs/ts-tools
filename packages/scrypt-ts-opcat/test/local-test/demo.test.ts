import * as dotenv from 'dotenv';

import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { Demo } from '../contracts/demo.js';
import { readArtifact } from '../utils/index.js';
import { DefaultSigner, ExtPsbt, bvmVerify } from '../../src/index.js';
use(chaiAsPromised);

dotenv.config();

describe('Test Demo', () => {
  let testSigner: DefaultSigner;

  before(() => {
    testSigner = new DefaultSigner();
    Demo.loadArtifact(readArtifact('demo.json'));
  });

  async function testAdd(x: bigint, y: bigint) {
    let demo: Demo = new Demo(x, y)
    demo.bindToUtxo({
      txId: 'c1a1a777a52f765ebfa295a35c12280279edd46073d41f4767602f819f574f82',
      outputIndex: 0,
      satoshis: 10000,
      data: '',
    });
    const address = await testSigner.getAddress();
    const psbt = new ExtPsbt()
      .addContractInput(demo, (contract) => {
        contract.add(x + y);
      })
      .change(address, 1)
      .seal()
      .finalizeAllInputs();

    expect(psbt.isFinalized).to.be.true;
    expect(bvmVerify(psbt, 0)).to.eq(true);
  }

  async function testSub(x: bigint, y: bigint) {
    let demo: Demo = new Demo(x, y)
    demo.bindToUtxo({
      txId: 'c1a1a777a52f765ebfa295a35c12280279edd46073d41f4767602f819f574f82',
      outputIndex: 0,
      satoshis: 10000,
      data: '',
    });
    const address = await testSigner.getAddress();
    const psbt = new ExtPsbt()
      .addContractInput(demo, (contract) => {
        contract.sub(x - y);
      })
      .change(address, 1)
      .seal()
      .finalizeAllInputs();

    expect(psbt.isFinalized).to.be.true;
    expect(bvmVerify(psbt, 0)).to.eq(true);
  }

  it('should call `unlock` method successfully.', async () => {
    await testAdd(8925n, 8925n);
    await testAdd(0n, 0n);
    await testAdd(1n, 1n);
    await testAdd(2n, 16n);
    await testAdd(-1n, 16n);
    await testAdd(-1n, -1n);
    await testAdd(0n, -1n);
    await testAdd(1n, -1n);
    await testSub(8925n, 8925n);
    await testSub(0n, 0n);
    await testSub(1n, 1n);
    await testSub(2n, 16n);
    await testSub(-1n, 16n);
    await testSub(-1n, -1n);
    await testSub(0n, 1n);
  });
});
