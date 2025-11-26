import * as dotenv from 'dotenv';
import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { Genesis } from '../contracts/genesis.js';
import { readArtifact } from '../utils/index.js';
import {
  ExtPsbt,
  bvmVerify,
  toByteString,
  genesisCheckDeploy,
} from '@opcat-labs/scrypt-ts-opcat';

use(chaiAsPromised);
dotenv.config();

describe('Test Genesis', () => {
  before(() => {
    Genesis.loadArtifact(readArtifact('genesis.json'));
  });

  /**
   * Test successful deployment with 3 unique outputs
   */
  it('should call `checkDeploy` method successfully.', async () => {
    const genesis: Genesis = new Genesis();
    genesis.bindToUtxo({
      txId: 'c1a1a777a52f765ebfa295a35c12280279edd46073d41f4767602f819f574f82',
      outputIndex: 0,
      satoshis: 10000,
      data: '',
    });

    const script1 = toByteString('51');
    const script2 = toByteString('52');
    const script3 = toByteString('53');

    const psbt = new ExtPsbt()
      .addContractInput(genesis, genesisCheckDeploy())
      .addOutput({
        script: Buffer.from(script1, 'hex'),
        value: 1000n,
        data: new Uint8Array(),
      })
      .addOutput({
        script: Buffer.from(script2, 'hex'),
        value: 1000n,
        data: new Uint8Array(),
      })
      .addOutput({
        script: Buffer.from(script3, 'hex'),
        value: 1000n,
        data: new Uint8Array(),
      })
      .seal()
      .finalizeAllInputs();

    expect(psbt.isFinalized).to.be.true;
    expect(bvmVerify(psbt, 0)).to.eq(true);
  });

  /**
   * Test failure: outputs[0] and outputs[1] have same scriptHash
   */
  it('should fail with duplicate scriptHash (outputs[0] == outputs[1])', async () => {
    const genesis = new Genesis();
    genesis.bindToUtxo({
      txId: 'c1a1a777a52f765ebfa295a35c12280279edd46073d41f4767602f819f574f82',
      outputIndex: 0,
      satoshis: 10000,
      data: '',
    });

    // outputs[0] and outputs[1] use the same script (duplicate)
    const script1 = toByteString('51');
    const script2 = toByteString('51'); // Same as script1 - duplicate!
    const script3 = toByteString('53');

    expect(() => {
      new ExtPsbt()
        .addContractInput(genesis, genesisCheckDeploy())
        .addOutput({
          script: Buffer.from(script1, 'hex'),
          value: 1000n,
          data: new Uint8Array(),
        })
        .addOutput({
          script: Buffer.from(script2, 'hex'),
          value: 1000n,
          data: new Uint8Array(),
        })
        .addOutput({
          script: Buffer.from(script3, 'hex'),
          value: 1000n,
          data: new Uint8Array(),
        })
        .seal()
        .finalizeAllInputs();
    }).to.throw();
  });

  /**
   * Test failure: outputs[0] and outputs[2] have same scriptHash
   */
  it('should fail with duplicate scriptHash (outputs[0] == outputs[2])', async () => {
    const genesis = new Genesis();
    genesis.bindToUtxo({
      txId: 'c1a1a777a52f765ebfa295a35c12280279edd46073d41f4767602f819f574f82',
      outputIndex: 0,
      satoshis: 10000,
      data: '',
    });

    // outputs[0] and outputs[2] use the same script (duplicate)
    const script1 = toByteString('51');
    const script2 = toByteString('52');
    const script3 = toByteString('51'); // Same as script1 - duplicate!

    expect(() => {
      new ExtPsbt()
        .addContractInput(genesis, genesisCheckDeploy())
        .addOutput({
          script: Buffer.from(script1, 'hex'),
          value: 1000n,
          data: new Uint8Array(),
        })
        .addOutput({
          script: Buffer.from(script2, 'hex'),
          value: 1000n,
          data: new Uint8Array(),
        })
        .addOutput({
          script: Buffer.from(script3, 'hex'),
          value: 1000n,
          data: new Uint8Array(),
        })
        .seal()
        .finalizeAllInputs();
    }).to.throw();
  });

  /**
   * Test failure: outputs[1] and outputs[2] have same scriptHash
   */
  it('should fail with duplicate scriptHash (outputs[1] == outputs[2])', async () => {
    const genesis = new Genesis();
    genesis.bindToUtxo({
      txId: 'c1a1a777a52f765ebfa295a35c12280279edd46073d41f4767602f819f574f82',
      outputIndex: 0,
      satoshis: 10000,
      data: '',
    });

    // outputs[1] and outputs[2] use the same script (duplicate)
    const script1 = toByteString('51');
    const script2 = toByteString('52');
    const script3 = toByteString('52'); // Same as script2 - duplicate!

    expect(() => {
      new ExtPsbt()
        .addContractInput(genesis, genesisCheckDeploy())
        .addOutput({
          script: Buffer.from(script1, 'hex'),
          value: 1000n,
          data: new Uint8Array(),
        })
        .addOutput({
          script: Buffer.from(script2, 'hex'),
          value: 1000n,
          data: new Uint8Array(),
        })
        .addOutput({
          script: Buffer.from(script3, 'hex'),
          value: 1000n,
          data: new Uint8Array(),
        })
        .seal()
        .finalizeAllInputs();
    }).to.throw();
  });

  /**
   * Test with 1 real output and 2 empty placeholders
   * Empty scriptHash should be skipped in uniqueness validation
   */
  it('should succeed with 1 real output and 2 empty placeholders', async () => {
    const genesis = new Genesis();
    genesis.bindToUtxo({
      txId: 'c1a1a777a52f765ebfa295a35c12280279edd46073d41f4767602f819f574f82',
      outputIndex: 0,
      satoshis: 10000,
      data: '',
    });

    const script1 = toByteString('51');

    const psbt = new ExtPsbt()
      .addContractInput(genesis, genesisCheckDeploy())
      .addOutput({
        script: Buffer.from(script1, 'hex'),
        value: 1000n,
        data: new Uint8Array(),
      })
      .seal()
      .finalizeAllInputs();

    expect(psbt.isFinalized).to.be.true;
    expect(bvmVerify(psbt, 0)).to.eq(true);
  });

  /**
   * Test with 2 real outputs and 1 empty placeholder
   */
  it('should succeed with 2 real outputs and 1 empty placeholder', async () => {
    const genesis = new Genesis();
    genesis.bindToUtxo({
      txId: 'c1a1a777a52f765ebfa295a35c12280279edd46073d41f4767602f819f574f82',
      outputIndex: 0,
      satoshis: 10000,
      data: '',
    });

    const script1 = toByteString('51');
    const script2 = toByteString('52');

    const psbt = new ExtPsbt()
      .addContractInput(genesis, genesisCheckDeploy())
      .addOutput({
        script: Buffer.from(script1, 'hex'),
        value: 1000n,
        data: new Uint8Array(),
      })
      .addOutput({
        script: Buffer.from(script2, 'hex'),
        value: 1000n,
        data: new Uint8Array(),
      })
      .seal()
      .finalizeAllInputs();

    expect(psbt.isFinalized).to.be.true;
    expect(bvmVerify(psbt, 0)).to.eq(true);
  });

  /**
   * Test failure: duplicate non-empty scriptHashes
   * genesisCheckDeploy will detect duplicates in actual outputs
   */
  it('should fail with duplicate scriptHash when outputs are duplicated', async () => {
    const genesis = new Genesis();
    genesis.bindToUtxo({
      txId: 'c1a1a777a52f765ebfa295a35c12280279edd46073d41f4767602f819f574f82',
      outputIndex: 0,
      satoshis: 10000,
      data: '',
    });

    const script1 = toByteString('51');

    expect(() => {
      new ExtPsbt()
        .addContractInput(genesis, genesisCheckDeploy())
        .addOutput({
          script: Buffer.from(script1, 'hex'),
          value: 1000n,
          data: new Uint8Array(),
        })
        .addOutput({
          script: Buffer.from(script1, 'hex'), // Duplicate!
          value: 1000n,
          data: new Uint8Array(),
        })
        .seal()
        .finalizeAllInputs();
    }).to.throw();
  });

  /**
   * Test with outputs containing data
   */
  it('should succeed with outputs containing data', async () => {
    const genesis = new Genesis();
    genesis.bindToUtxo({
      txId: 'c1a1a777a52f765ebfa295a35c12280279edd46073d41f4767602f819f574f82',
      outputIndex: 0,
      satoshis: 10000,
      data: '',
    });

    const script1 = toByteString('51');
    const script2 = toByteString('52');
    const data1 = toByteString('deadbeef');
    const data2 = toByteString('cafebabe');

    const psbt = new ExtPsbt()
      .addContractInput(genesis, genesisCheckDeploy())
      .addOutput({
        script: Buffer.from(script1, 'hex'),
        value: 1000n,
        data: Buffer.from(data1, 'hex'),
      })
      .addOutput({
        script: Buffer.from(script2, 'hex'),
        value: 2000n,
        data: Buffer.from(data2, 'hex'),
      })
      .seal()
      .finalizeAllInputs();

    expect(psbt.isFinalized).to.be.true;
    expect(bvmVerify(psbt, 0)).to.eq(true);
  });

  /**
   * Test with all 3 empty placeholders - should succeed
   * This is an edge case where no real outputs are validated
   */
  it('should succeed with all 3 empty placeholders (no outputs)', async () => {
    const genesis = new Genesis();
    genesis.bindToUtxo({
      txId: 'c1a1a777a52f765ebfa295a35c12280279edd46073d41f4767602f819f574f82',
      outputIndex: 0,
      satoshis: 10000,
      data: '',
    });

    const psbt = new ExtPsbt()
      .addContractInput(genesis, genesisCheckDeploy())
      .seal()
      .finalizeAllInputs();

    expect(psbt.isFinalized).to.be.true;
    expect(bvmVerify(psbt, 0)).to.eq(true);
  });

  /**
   * Test with different satoshi amounts
   */
  it('should succeed with varying satoshi amounts', async () => {
    const genesis = new Genesis();
    genesis.bindToUtxo({
      txId: 'c1a1a777a52f765ebfa295a35c12280279edd46073d41f4767602f819f574f82',
      outputIndex: 0,
      satoshis: 10000,
      data: '',
    });

    const script1 = toByteString('51');
    const script2 = toByteString('52');
    const script3 = toByteString('53');

    const psbt = new ExtPsbt()
      .addContractInput(genesis, genesisCheckDeploy())
      .addOutput({
        script: Buffer.from(script1, 'hex'),
        value: 546n, // Dust limit
        data: new Uint8Array(),
      })
      .addOutput({
        script: Buffer.from(script2, 'hex'),
        value: 5000n, // Moderate amount
        data: new Uint8Array(),
      })
      .addOutput({
        script: Buffer.from(script3, 'hex'),
        value: 1000n, // Small amount
        data: new Uint8Array(),
      })
      .seal()
      .finalizeAllInputs();

    expect(psbt.isFinalized).to.be.true;
    expect(bvmVerify(psbt, 0)).to.eq(true);
  });
});
