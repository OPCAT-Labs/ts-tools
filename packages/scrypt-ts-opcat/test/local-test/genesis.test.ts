import * as dotenv from 'dotenv';
import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { Genesis } from '../contracts/genesis.js';
import { readArtifact } from '../utils/index.js';
import {
  DefaultSigner,
  ExtPsbt,
  bvmVerify,
  toByteString,
  TxOut,
  sha256,
} from '@opcat-labs/scrypt-ts-opcat';

use(chaiAsPromised);
dotenv.config();

describe('Test Genesis', () => {
  let testSigner: DefaultSigner;

  before(() => {
    testSigner = new DefaultSigner();
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
    // Create 3 outputs with different scriptHashes (using different addresses)
    // These scriptHashes should be the hash of different P2WPKH scripts
    const output1: TxOut = {
      scriptHash: sha256(script1),
      satoshis: 1000n,
      dataHash: sha256(toByteString('')), // Must be 32 bytes
    };

    const output2: TxOut = {
      scriptHash: sha256(script2),
      satoshis: 1000n,
      dataHash: sha256(toByteString('')), // Must be 32 bytes
    };

    const output3: TxOut = {
      scriptHash: sha256(script3),
      satoshis: 1000n,
      dataHash: sha256(toByteString('')), // Must be 32 bytes
    };

    const psbt = new ExtPsbt()
      .addContractInput(genesis, (contract: Genesis) => {
        contract.checkDeploy([output1, output2, output3]);
      })
      .addOutput({
        script: Buffer.from(script1, 'hex'),
        value: output1.satoshis,
        data: new Uint8Array(),
      })
      .addOutput({
        script: Buffer.from(script2, 'hex'),
        value: output2.satoshis,
        data: new Uint8Array(),
      })
      .addOutput({
        script: Buffer.from(script3, 'hex'),
        value: output3.satoshis,
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

    const output1: TxOut = {
      scriptHash: sha256(script1),
      satoshis: 1000n,
      dataHash: sha256(toByteString('')),
    };

    const output2: TxOut = {
      scriptHash: sha256(script2), // Duplicate!
      satoshis: 1000n,
      dataHash: sha256(toByteString('')),
    };

    const output3: TxOut = {
      scriptHash: sha256(script3),
      satoshis: 1000n,
      dataHash: sha256(toByteString('')),
    };

    expect(() => {
      new ExtPsbt()
        .addContractInput(genesis, (contract) => {
          contract.checkDeploy([output1, output2, output3]);
        })
        .addOutput({
          script: Buffer.from(script1, 'hex'),
          value: output1.satoshis,
          data: new Uint8Array(),
        })
        .addOutput({
          script: Buffer.from(script2, 'hex'),
          value: output2.satoshis,
          data: new Uint8Array(),
        })
        .addOutput({
          script: Buffer.from(script3, 'hex'),
          value: output3.satoshis,
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

    const output1: TxOut = {
      scriptHash: sha256(script1),
      satoshis: 1000n,
      dataHash: sha256(toByteString('')),
    };

    const output2: TxOut = {
      scriptHash: sha256(script2),
      satoshis: 1000n,
      dataHash: sha256(toByteString('')),
    };

    const output3: TxOut = {
      scriptHash: sha256(script3), // Duplicate!
      satoshis: 1000n,
      dataHash: sha256(toByteString('')),
    };

    expect(() => {
      new ExtPsbt()
        .addContractInput(genesis, (contract) => {
          contract.checkDeploy([output1, output2, output3]);
        })
        .addOutput({
          script: Buffer.from(script1, 'hex'),
          value: output1.satoshis,
          data: new Uint8Array(),
        })
        .addOutput({
          script: Buffer.from(script2, 'hex'),
          value: output2.satoshis,
          data: new Uint8Array(),
        })
        .addOutput({
          script: Buffer.from(script3, 'hex'),
          value: output3.satoshis,
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

    const output1: TxOut = {
      scriptHash: sha256(script1),
      satoshis: 1000n,
      dataHash: sha256(toByteString('')),
    };

    const output2: TxOut = {
      scriptHash: sha256(script2),
      satoshis: 1000n,
      dataHash: sha256(toByteString('')),
    };

    const output3: TxOut = {
      scriptHash: sha256(script3), // Duplicate!
      satoshis: 1000n,
      dataHash: sha256(toByteString('')),
    };

    expect(() => {
      new ExtPsbt()
        .addContractInput(genesis, (contract) => {
          contract.checkDeploy([output1, output2, output3]);
        })
        .addOutput({
          script: Buffer.from(script1, 'hex'),
          value: output1.satoshis,
          data: new Uint8Array(),
        })
        .addOutput({
          script: Buffer.from(script2, 'hex'),
          value: output2.satoshis,
          data: new Uint8Array(),
        })
        .addOutput({
          script: Buffer.from(script3, 'hex'),
          value: output3.satoshis,
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

    // First output is real, others are empty placeholders
    const output1: TxOut = {
      scriptHash: sha256(script1),
      satoshis: 1000n,
      dataHash: sha256(toByteString('')),
    };

    // Empty placeholder outputs
    const emptyOutput: TxOut = {
      scriptHash: toByteString(''), // Empty - should be skipped
      satoshis: 0n,
      dataHash: sha256(toByteString('')),
    };

    const psbt = new ExtPsbt()
      .addContractInput(genesis, (contract) => {
        contract.checkDeploy([output1, emptyOutput, emptyOutput]);
      })
      .addOutput({
        script: Buffer.from(script1, 'hex'),
        value: output1.satoshis,
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

    const output1: TxOut = {
      scriptHash: sha256(script1),
      satoshis: 1000n,
      dataHash: sha256(toByteString('')),
    };

    const output2: TxOut = {
      scriptHash: sha256(script2),
      satoshis: 1000n,
      dataHash: sha256(toByteString('')),
    };

    // Empty placeholder
    const emptyOutput: TxOut = {
      scriptHash: toByteString(''),
      satoshis: 0n,
      dataHash: sha256(toByteString('')),
    };

    const psbt = new ExtPsbt()
      .addContractInput(genesis, (contract) => {
        contract.checkDeploy([output1, output2, emptyOutput]);
      })
      .addOutput({
        script: Buffer.from(script1, 'hex'),
        value: output1.satoshis,
        data: new Uint8Array(),
      })
      .addOutput({
        script: Buffer.from(script2, 'hex'),
        value: output2.satoshis,
        data: new Uint8Array(),
      })
      .seal()
      .finalizeAllInputs();

    expect(psbt.isFinalized).to.be.true;
    expect(bvmVerify(psbt, 0)).to.eq(true);
  });

  /**
   * Test with empty placeholder in the middle (output[1] is empty)
   */
  it('should succeed with empty placeholder in the middle', async () => {
    const genesis = new Genesis();
    genesis.bindToUtxo({
      txId: 'c1a1a777a52f765ebfa295a35c12280279edd46073d41f4767602f819f574f82',
      outputIndex: 0,
      satoshis: 10000,
      data: '',
    });

    const script1 = toByteString('51');
    const script3 = toByteString('53');

    const output1: TxOut = {
      scriptHash: sha256(script1),
      satoshis: 1000n,
      dataHash: sha256(toByteString('')),
    };

    // Empty placeholder in the middle
    const emptyOutput: TxOut = {
      scriptHash: toByteString(''),
      satoshis: 0n,
      dataHash: sha256(toByteString('')),
    };

    const output3: TxOut = {
      scriptHash: sha256(script3),
      satoshis: 1000n,
      dataHash: sha256(toByteString('')),
    };

    const psbt = new ExtPsbt()
      .addContractInput(genesis, (contract) => {
        contract.checkDeploy([output1, emptyOutput, output3]);
      })
      .addOutput({
        script: Buffer.from(script1, 'hex'),
        value: output1.satoshis,
        data: new Uint8Array(),
      })
      .addOutput({
        script: Buffer.from(script3, 'hex'),
        value: output3.satoshis,
        data: new Uint8Array(),
      })
      .seal()
      .finalizeAllInputs();

    expect(psbt.isFinalized).to.be.true;
    expect(bvmVerify(psbt, 0)).to.eq(true);
  });

  /**
   * Test failure: duplicate non-empty scriptHashes with empty placeholder
   * Even with an empty placeholder, duplicates among non-empty outputs should fail
   */
  it('should fail with duplicate scriptHash when one output is empty', async () => {
    const genesis = new Genesis();
    genesis.bindToUtxo({
      txId: 'c1a1a777a52f765ebfa295a35c12280279edd46073d41f4767602f819f574f82',
      outputIndex: 0,
      satoshis: 10000,
      data: '',
    });

    const script1 = toByteString('51');

    // output1 and output3 have same scriptHash (duplicate)
    const output1: TxOut = {
      scriptHash: sha256(script1),
      satoshis: 1000n,
      dataHash: sha256(toByteString('')),
    };

    // Empty placeholder
    const emptyOutput: TxOut = {
      scriptHash: toByteString(''),
      satoshis: 0n,
      dataHash: sha256(toByteString('')),
    };

    // Same scriptHash as output1 - should fail
    const output3: TxOut = {
      scriptHash: sha256(script1), // Duplicate!
      satoshis: 1000n,
      dataHash: sha256(toByteString('')),
    };

    expect(() => {
      new ExtPsbt()
        .addContractInput(genesis, (contract) => {
          contract.checkDeploy([output1, emptyOutput, output3]);
        })
        .addOutput({
          script: Buffer.from(script1, 'hex'),
          value: output1.satoshis,
          data: new Uint8Array(),
        })
        .addOutput({
          script: Buffer.from(script1, 'hex'),
          value: output3.satoshis,
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

    const output1: TxOut = {
      scriptHash: sha256(script1),
      satoshis: 1000n,
      dataHash: sha256(data1),
    };

    const output2: TxOut = {
      scriptHash: sha256(script2),
      satoshis: 2000n,
      dataHash: sha256(data2),
    };

    const emptyOutput: TxOut = {
      scriptHash: toByteString(''),
      satoshis: 0n,
      dataHash: sha256(toByteString('')),
    };

    const psbt = new ExtPsbt()
      .addContractInput(genesis, (contract) => {
        contract.checkDeploy([output1, output2, emptyOutput]);
      })
      .addOutput({
        script: Buffer.from(script1, 'hex'),
        value: output1.satoshis,
        data: Buffer.from(data1, 'hex'),
      })
      .addOutput({
        script: Buffer.from(script2, 'hex'),
        value: output2.satoshis,
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
  it('should succeed with all 3 empty placeholders', async () => {
    const genesis = new Genesis();
    genesis.bindToUtxo({
      txId: 'c1a1a777a52f765ebfa295a35c12280279edd46073d41f4767602f819f574f82',
      outputIndex: 0,
      satoshis: 10000,
      data: '',
    });

    const emptyOutput: TxOut = {
      scriptHash: toByteString(''),
      satoshis: 0n,
      dataHash: sha256(toByteString('')),
    };

    const psbt = new ExtPsbt()
      .addContractInput(genesis, (contract) => {
        contract.checkDeploy([emptyOutput, emptyOutput, emptyOutput]);
      })
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

    const output1: TxOut = {
      scriptHash: sha256(script1),
      satoshis: 546n, // Dust limit
      dataHash: sha256(toByteString('')),
    };

    const output2: TxOut = {
      scriptHash: sha256(script2),
      satoshis: 5000n, // Moderate amount
      dataHash: sha256(toByteString('')),
    };

    const output3: TxOut = {
      scriptHash: sha256(script3),
      satoshis: 1000n, // Small amount
      dataHash: sha256(toByteString('')),
    };

    const psbt = new ExtPsbt()
      .addContractInput(genesis, (contract) => {
        contract.checkDeploy([output1, output2, output3]);
      })
      .addOutput({
        script: Buffer.from(script1, 'hex'),
        value: output1.satoshis,
        data: new Uint8Array(),
      })
      .addOutput({
        script: Buffer.from(script2, 'hex'),
        value: output2.satoshis,
        data: new Uint8Array(),
      })
      .addOutput({
        script: Buffer.from(script3, 'hex'),
        value: output3.satoshis,
        data: new Uint8Array(),
      })
      .seal()
      .finalizeAllInputs();

    expect(psbt.isFinalized).to.be.true;
    expect(bvmVerify(psbt, 0)).to.eq(true);
  });
});
