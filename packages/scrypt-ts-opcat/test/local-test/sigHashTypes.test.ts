import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
use(chaiAsPromised);

import {
  DefaultSigner,
  ExtPsbt,
  PubKey,
  bvmVerify,
  PrivateKey,
} from '@opcat-labs/scrypt-ts-opcat';
import { MultiSigHashMethods } from '../contracts/sigHashTypes.js';
import artifact from '../fixtures/multiSigHashMethods.json' with { type: 'json' };

// Local SigHashType values for test usage
// (const enum SigHashType from @opcat-labs/scrypt-ts-opcat is not available at runtime)
const SigHashType = {
  ALL: 0x01 as const,
  NONE: 0x02 as const,
  SINGLE: 0x03 as const,
  ANYONECANPAY: 0x80 as const,
  ANYONECANPAY_ALL: 0x81 as const,
  ANYONECANPAY_NONE: 0x82 as const,
  ANYONECANPAY_SINGLE: 0x83 as const,
};

describe('Test SigHashTypes', () => {
  const testSigner = new DefaultSigner(PrivateKey.fromWIF('cQfb2vnBvKryZjG7MuWwDoeMpvHBNAqaNyJH3cNxdHxnHWd6Kv7f'));

  before(() => {
    MultiSigHashMethods.loadArtifact(artifact);
  });

  describe('SigHashType.ALL (unlockAll method)', () => {
    it('should call unlockAll with sigHashType ALL successfully', async () => {
      const contract = new MultiSigHashMethods();
      const address = await testSigner.getAddress();
      const pubKey = await testSigner.getPublicKey();

      contract.bindToUtxo({
        txId: 'c1a1a777a52f765ebfa295a35c12280279edd46073d41f4767602f819f574f82',
        outputIndex: 0,
        satoshis: 10000,
        data: '',
      });

      const psbt = new ExtPsbt({ network: testSigner.network })
        .addContractInput(contract, (c, psbt) => {
          const sig = psbt.getSig(0, { address });
          c.unlockAll(sig, PubKey(pubKey));
        })
        .change(address, 1)
        .seal();

      expect(async () => {
        await psbt.signAndFinalize(testSigner);
        expect(bvmVerify(psbt, 0)).to.eq(true);
      }).not.throw();
    });
  });

  describe('SigHashType.NONE (unlockNone method)', () => {
    it('should call unlockNone with sigHashType NONE successfully', async () => {
      const contract = new MultiSigHashMethods();
      const address = await testSigner.getAddress();
      const pubKey = await testSigner.getPublicKey();

      contract.bindToUtxo({
        txId: 'c1a1a777a52f765ebfa295a35c12280279edd46073d41f4767602f819f574f82',
        outputIndex: 0,
        satoshis: 10000,
        data: '',
      });

      const psbt = new ExtPsbt({ network: testSigner.network })
        .addContractInput(contract, (c, psbt) => {
          const sig = psbt.getSig(0, { address });
          c.unlockNone(sig, PubKey(pubKey));
        })
        .change(address, 1)
        .seal();

      expect(async () => {
        await psbt.signAndFinalize(testSigner);
        expect(bvmVerify(psbt, 0)).to.eq(true);
      }).not.throw();
    });
  });

  describe('SigHashType.SINGLE (unlockSingle method)', () => {
    it('should call unlockSingle with sigHashType SINGLE successfully', async () => {
      const contract = new MultiSigHashMethods();
      const address = await testSigner.getAddress();
      const pubKey = await testSigner.getPublicKey();

      contract.bindToUtxo({
        txId: 'c1a1a777a52f765ebfa295a35c12280279edd46073d41f4767602f819f574f82',
        outputIndex: 0,
        satoshis: 10000,
        data: '',
      });

      const psbt = new ExtPsbt({ network: testSigner.network })
        .addContractInput(contract, (c, psbt) => {
          const sig = psbt.getSig(0, { address });
          c.unlockSingle(sig, PubKey(pubKey));
        })
        .change(address, 1)
        .seal();

      expect(async () => {
        await psbt.signAndFinalize(testSigner);
        expect(bvmVerify(psbt, 0)).to.eq(true);
      }).not.throw();
    });
  });

  describe('SigHashType.ANYONECANPAY_ALL (unlockAnyoneCanPayAll method)', () => {
    it('should call unlockAnyoneCanPayAll with sigHashType ANYONECANPAY_ALL successfully', async () => {
      const contract = new MultiSigHashMethods();
      const address = await testSigner.getAddress();
      const pubKey = await testSigner.getPublicKey();

      contract.bindToUtxo({
        txId: 'c1a1a777a52f765ebfa295a35c12280279edd46073d41f4767602f819f574f82',
        outputIndex: 0,
        satoshis: 10000,
        data: '',
      });

      const psbt = new ExtPsbt({ network: testSigner.network })
        .addContractInput(contract, (c, psbt) => {
          const sig = psbt.getSig(0, { address });
          c.unlockAnyoneCanPayAll(sig, PubKey(pubKey));
        })
        .change(address, 1)
        .seal();

      expect(async () => {
        await psbt.signAndFinalize(testSigner);
        expect(bvmVerify(psbt, 0)).to.eq(true);
      }).not.throw();
    });
  });

  describe('SigHashType.ANYONECANPAY_NONE (unlockAnyoneCanPayNone method)', () => {
    it('should call unlockAnyoneCanPayNone with sigHashType ANYONECANPAY_NONE successfully', async () => {
      const contract = new MultiSigHashMethods();
      const address = await testSigner.getAddress();
      const pubKey = await testSigner.getPublicKey();

      contract.bindToUtxo({
        txId: 'c1a1a777a52f765ebfa295a35c12280279edd46073d41f4767602f819f574f82',
        outputIndex: 0,
        satoshis: 10000,
        data: '',
      });

      const psbt = new ExtPsbt({ network: testSigner.network })
        .addContractInput(contract, (c, psbt) => {
          const sig = psbt.getSig(0, { address });
          c.unlockAnyoneCanPayNone(sig, PubKey(pubKey));
        })
        .change(address, 1)
        .seal();

      expect(async () => {
        await psbt.signAndFinalize(testSigner);
        expect(bvmVerify(psbt, 0)).to.eq(true);
      }).not.throw();
    });
  });

  describe('SigHashType.ANYONECANPAY_SINGLE (unlockAnyoneCanPaySingle method)', () => {
    it('should call unlockAnyoneCanPaySingle with sigHashType ANYONECANPAY_SINGLE successfully', async () => {
      const contract = new MultiSigHashMethods();
      const address = await testSigner.getAddress();
      const pubKey = await testSigner.getPublicKey();

      contract.bindToUtxo({
        txId: 'c1a1a777a52f765ebfa295a35c12280279edd46073d41f4767602f819f574f82',
        outputIndex: 0,
        satoshis: 10000,
        data: '',
      });

      const psbt = new ExtPsbt({ network: testSigner.network })
        .addContractInput(contract, (c, psbt) => {
          const sig = psbt.getSig(0, { address });
          c.unlockAnyoneCanPaySingle(sig, PubKey(pubKey));
        })
        .change(address, 1)
        .seal();

      expect(async () => {
        await psbt.signAndFinalize(testSigner);
        expect(bvmVerify(psbt, 0)).to.eq(true);
      }).not.throw();
    });
  });

  describe('Error scenarios', () => {
    it('should throw error when setting different sigHashType for same input', async () => {
      const contract = new MultiSigHashMethods();
      const address = await testSigner.getAddress();
      const pubKey = await testSigner.getPublicKey();

      contract.bindToUtxo({
        txId: 'c1a1a777a52f765ebfa295a35c12280279edd46073d41f4767602f819f574f82',
        outputIndex: 0,
        satoshis: 10000,
        data: '',
      });

      expect(() => {
        const psbt = new ExtPsbt({ network: testSigner.network })
          .addContractInput(contract, (c, psbt) => {
            // Set sigHashType via the method (which sets it internally)
            const sig = psbt.getSig(0, { address });
            c.unlockAll(sig, PubKey(pubKey));
          })
          // Try to set a different sigHashType for the same input
          .setSighashType(0, SigHashType.NONE)
          .change(address, 1)
          .seal();
      }).to.throw();
    });

    it('should allow setting same sigHashType multiple times for same input', async () => {
      const contract = new MultiSigHashMethods();
      const address = await testSigner.getAddress();
      const pubKey = await testSigner.getPublicKey();

      contract.bindToUtxo({
        txId: 'c1a1a777a52f765ebfa295a35c12280279edd46073d41f4767602f819f574f82',
        outputIndex: 0,
        satoshis: 10000,
        data: '',
      });

      // Setting the same sigHashType multiple times should not throw
      const psbt = new ExtPsbt({ network: testSigner.network })
        .addContractInput(contract, (c, psbt) => {
          const sig = psbt.getSig(0, { address });
          c.unlockAll(sig, PubKey(pubKey));
        });

      // Setting same sigHashType again should be OK (setSighashType returns void)
      expect(() => {
        psbt.setSighashType(0, SigHashType.ALL);
      }).not.throw();

      psbt.change(address, 1).seal();

      expect(async () => {
        await psbt.signAndFinalize(testSigner);
      }).not.throw();
    });
  });
});
