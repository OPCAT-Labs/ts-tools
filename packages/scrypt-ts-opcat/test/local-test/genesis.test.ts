import * as dotenv from 'dotenv';
import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { Genesis, MAX_GENESIS_CHECK_OUTPUT } from '../contracts/genesis.js';
import { readArtifact } from '../utils/index.js';
import {
  ExtPsbt,
  bvmVerify,
  toByteString,
  sha256,
  TxOut,
  fill,
} from '@opcat-labs/scrypt-ts-opcat';
import { FixedArray } from '../../src/index.js';
import { uint8ArrayToHex } from '../../src/utils/common.js';

use(chaiAsPromised);
dotenv.config();

/**
 * Creates a contract call function for Genesis.checkDeploy that automatically
 * builds the TxOut array from the transaction outputs.
 */
function genesisCheckDeploy() {
  return (contract: Genesis, psbt: ExtPsbt) => {
    // Create output array with empty placeholders
    const emptyOutput: TxOut = {
      scriptHash: toByteString(''),
      satoshis: 0n,
      dataHash: sha256(toByteString('')),
    };
    const outputs: TxOut[] = fill(emptyOutput, MAX_GENESIS_CHECK_OUTPUT);

    // Fill with actual outputs from the transaction
    const txOutputs = psbt.txOutputs;
    for (let i = 0; i < txOutputs.length && i < MAX_GENESIS_CHECK_OUTPUT; i++) {
      const output = txOutputs[i];
      outputs[i] = {
        scriptHash: sha256(toByteString(uint8ArrayToHex(output.script))),
        satoshis: BigInt(output.value),
        dataHash: sha256(toByteString(uint8ArrayToHex(output.data))),
      };
    }

    contract.checkDeploy(outputs as FixedArray<TxOut, typeof MAX_GENESIS_CHECK_OUTPUT>);
  };
}

describe('Test Genesis', () => {
  before(() => {
    Genesis.loadArtifact(readArtifact('genesis.json'));
  });

  /**
   * Test successful deployment with unique output[0]
   */
  it('should call `checkDeploy` method successfully with unique output[0].', async () => {
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
   * Test failure: output[0] same as output[1]
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
   * Test failure: output[0] same as output[2]
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
   * Test success: output[1] same as output[2] is allowed
   * Only output[0] needs to be unique, other outputs can be duplicated
   */
  it('should succeed when outputs[1] == outputs[2] (only output[0] must be unique)', async () => {
    const genesis = new Genesis();
    genesis.bindToUtxo({
      txId: 'c1a1a777a52f765ebfa295a35c12280279edd46073d41f4767602f819f574f82',
      outputIndex: 0,
      satoshis: 10000,
      data: '',
    });

    // outputs[1] and outputs[2] use the same script - this is allowed!
    const script1 = toByteString('51');
    const script2 = toByteString('52');
    const script3 = toByteString('52'); // Same as script2 - allowed!

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
   * Test with 1 real output and empty placeholders
   */
  it('should succeed with 1 real output and empty placeholders', async () => {
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
   * Test with 2 real outputs and empty placeholders
   */
  it('should succeed with 2 real outputs and empty placeholders', async () => {
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
   * Test failure: output[0] duplicated with output[1]
   */
  it('should fail when output[0] is duplicated with output[1]', async () => {
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
          script: Buffer.from(script1, 'hex'), // Duplicate with output[0]!
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
   * Test failure: no outputs (output[0] is empty)
   * output[0] must not be empty
   */
  it('should fail when output[0] is empty (no outputs)', async () => {
    const genesis = new Genesis();
    genesis.bindToUtxo({
      txId: 'c1a1a777a52f765ebfa295a35c12280279edd46073d41f4767602f819f574f82',
      outputIndex: 0,
      satoshis: 10000,
      data: '',
    });

    expect(() => {
      new ExtPsbt()
        .addContractInput(genesis, genesisCheckDeploy())
        .seal()
        .finalizeAllInputs();
    }).to.throw();
  });

  /**
   * Test with varying satoshi amounts
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

  /**
   * Test with 6 outputs (max capacity)
   */
  it('should succeed with 6 unique outputs', async () => {
    const genesis = new Genesis();
    genesis.bindToUtxo({
      txId: 'c1a1a777a52f765ebfa295a35c12280279edd46073d41f4767602f819f574f82',
      outputIndex: 0,
      satoshis: 10000,
      data: '',
    });

    const psbt = new ExtPsbt()
      .addContractInput(genesis, genesisCheckDeploy())
      .addOutput({
        script: Buffer.from('51', 'hex'),
        value: 1000n,
        data: new Uint8Array(),
      })
      .addOutput({
        script: Buffer.from('52', 'hex'),
        value: 1000n,
        data: new Uint8Array(),
      })
      .addOutput({
        script: Buffer.from('53', 'hex'),
        value: 1000n,
        data: new Uint8Array(),
      })
      .addOutput({
        script: Buffer.from('54', 'hex'),
        value: 1000n,
        data: new Uint8Array(),
      })
      .addOutput({
        script: Buffer.from('55', 'hex'),
        value: 1000n,
        data: new Uint8Array(),
      })
      .addOutput({
        script: Buffer.from('56', 'hex'),
        value: 1000n,
        data: new Uint8Array(),
      })
      .seal()
      .finalizeAllInputs();

    expect(psbt.isFinalized).to.be.true;
    expect(bvmVerify(psbt, 0)).to.eq(true);
  });

  /**
   * Test failure: output[0] same as output[5]
   */
  it('should fail when output[0] == output[5]', async () => {
    const genesis = new Genesis();
    genesis.bindToUtxo({
      txId: 'c1a1a777a52f765ebfa295a35c12280279edd46073d41f4767602f819f574f82',
      outputIndex: 0,
      satoshis: 10000,
      data: '',
    });

    expect(() => {
      new ExtPsbt()
        .addContractInput(genesis, genesisCheckDeploy())
        .addOutput({
          script: Buffer.from('51', 'hex'),
          value: 1000n,
          data: new Uint8Array(),
        })
        .addOutput({
          script: Buffer.from('52', 'hex'),
          value: 1000n,
          data: new Uint8Array(),
        })
        .addOutput({
          script: Buffer.from('53', 'hex'),
          value: 1000n,
          data: new Uint8Array(),
        })
        .addOutput({
          script: Buffer.from('54', 'hex'),
          value: 1000n,
          data: new Uint8Array(),
        })
        .addOutput({
          script: Buffer.from('55', 'hex'),
          value: 1000n,
          data: new Uint8Array(),
        })
        .addOutput({
          script: Buffer.from('51', 'hex'), // Same as output[0]!
          value: 1000n,
          data: new Uint8Array(),
        })
        .seal()
        .finalizeAllInputs();
    }).to.throw();
  });

  /**
   * Test input scriptHash validation
   * Ensures output[0] scriptHash differs from all input scriptHashes
   */
  describe('Input scriptHash validation', () => {
    /**
     * Test success: output[0] scriptHash differs from input scriptHash
     * This is the normal case - existing tests already cover this implicitly,
     * but we add an explicit test to document the behavior.
     */
    it('should succeed when output[0] scriptHash differs from input scriptHash', async () => {
      const genesis = new Genesis();
      genesis.bindToUtxo({
        txId: 'c1a1a777a52f765ebfa295a35c12280279edd46073d41f4767602f819f574f82',
        outputIndex: 0,
        satoshis: 10000,
        data: '',
      });

      // output[0] uses a different script than Genesis input
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
     * Test failure: output[0] scriptHash matches input[0] scriptHash
     * This tests the new input validation logic that prevents deploying
     * a contract with the same scriptHash as any input.
     */
    it('should fail when output[0] scriptHash matches input[0] scriptHash', async () => {
      const genesis = new Genesis();
      genesis.bindToUtxo({
        txId: 'c1a1a777a52f765ebfa295a35c12280279edd46073d41f4767602f819f574f82',
        outputIndex: 0,
        satoshis: 10000,
        data: '',
      });

      // Get the Genesis contract's locking script
      const genesisScript = genesis.lockingScript.toBuffer();

      expect(() => {
        new ExtPsbt()
          .addContractInput(genesis, genesisCheckDeploy())
          // output[0] uses the SAME script as Genesis input - should fail!
          .addOutput({
            script: genesisScript,
            value: 1000n,
            data: new Uint8Array(),
          })
          .addOutput({
            script: Buffer.from('52', 'hex'),
            value: 1000n,
            data: new Uint8Array(),
          })
          .seal()
          .finalizeAllInputs();
      }).to.throw();
    });
  });
});
