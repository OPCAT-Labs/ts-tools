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
});
