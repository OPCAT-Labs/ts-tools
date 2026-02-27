import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
use(chaiAsPromised);

import {
  DefaultSigner,
  ExtPsbt,
  PubKey,
  bvmVerify,
} from '@opcat-labs/scrypt-ts-opcat';
import { CheckSigWithFlagTest } from '../contracts/checkSigWithFlag.js';
import artifact from '../fixtures/checkSigWithFlag.json' with { type: 'json' };
import { testKeyPair } from '../utils/privateKey.js';

// Local SigHashType values for test usage
const SigHashType = {
  ALL: 0x01 as const,
  NONE: 0x02 as const,
  SINGLE: 0x03 as const,
  ANYONECANPAY: 0x80 as const,
  ANYONECANPAY_ALL: 0x81 as const,
  ANYONECANPAY_NONE: 0x82 as const,
  ANYONECANPAY_SINGLE: 0x83 as const,
};

describe('Test checkSigWithFlag', () => {
  const testSigner = new DefaultSigner(testKeyPair);

  before(() => {
    CheckSigWithFlagTest.loadArtifact(artifact);
  });

  describe('unlockWithAllFlag - verify SIGHASH_ALL flag (0x01)', () => {
    it('should verify signature with SIGHASH_ALL flag successfully', async () => {
      const contract = new CheckSigWithFlagTest();
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
          c.unlockWithAllFlag(sig, PubKey(pubKey));
        })
        .change(address, 1)
        .seal();

      await psbt.signAndFinalize(testSigner);
      expect(bvmVerify(psbt, 0)).to.eq(true);
    });

    it('should fail when method expects ALL but tries to use NONE sigHashType', async () => {
      const contract = new CheckSigWithFlagTest();
      const address = await testSigner.getAddress();
      const pubKey = await testSigner.getPublicKey();

      contract.bindToUtxo({
        txId: 'c1a1a777a52f765ebfa295a35c12280279edd46073d41f4767602f819f574f82',
        outputIndex: 0,
        satoshis: 10000,
        data: '',
      });

      // The unlockWithAllFlag method has sigHashType.ALL decorator.
      // Trying to set a different sigHashType should fail.
      expect(() => {
        new ExtPsbt({ network: testSigner.network })
          .addContractInput(contract, (c, psbt) => {
            const sig = psbt.getSig(0, { address });
            c.unlockWithAllFlag(sig, PubKey(pubKey));
          })
          .setSighashType(0, SigHashType.NONE)
          .change(address, 1)
          .seal();
      }).to.throw();
    });
  });

  describe('unlockWithNoneFlag - verify SIGHASH_NONE flag (0x02)', () => {
    it('should verify signature with SIGHASH_NONE flag successfully', async () => {
      const contract = new CheckSigWithFlagTest();
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
          c.unlockWithNoneFlag(sig, PubKey(pubKey));
        })
        .change(address, 1)
        .seal();

      await psbt.signAndFinalize(testSigner);
      expect(bvmVerify(psbt, 0)).to.eq(true);
    });

    it('should fail when method expects NONE but tries to use ALL sigHashType', async () => {
      const contract = new CheckSigWithFlagTest();
      const address = await testSigner.getAddress();
      const pubKey = await testSigner.getPublicKey();

      contract.bindToUtxo({
        txId: 'c1a1a777a52f765ebfa295a35c12280279edd46073d41f4767602f819f574f82',
        outputIndex: 0,
        satoshis: 10000,
        data: '',
      });

      // The unlockWithNoneFlag method has sigHashType.NONE decorator.
      // Trying to set a different sigHashType should fail.
      expect(() => {
        new ExtPsbt({ network: testSigner.network })
          .addContractInput(contract, (c, psbt) => {
            const sig = psbt.getSig(0, { address });
            c.unlockWithNoneFlag(sig, PubKey(pubKey));
          })
          .setSighashType(0, SigHashType.ALL)
          .change(address, 1)
          .seal();
      }).to.throw();
    });
  });

  // Note: ANYONECANPAY tests are commented out because they require
  // sighash preimage verification which is only injected when accessing ctx variables.
  // The checkSigWithFlag method is designed for explicit flag verification without ctx dependencies.
  // For ANYONECANPAY verification with ctx, use the sigHashTypes pattern instead.
  // describe('unlockWithAnyonecanpayAllFlag - verify ANYONECANPAY_ALL flag (0x81)', () => { ... });

  describe('unlockWithDynamicFlag - verify dynamic flag parameter', () => {
    it('should verify signature with dynamic SIGHASH_ALL flag', async () => {
      const contract = new CheckSigWithFlagTest();
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
          c.unlockWithDynamicFlag(sig, PubKey(pubKey), 1n);
        })
        .change(address, 1)
        .seal();

      await psbt.signAndFinalize(testSigner);
      expect(bvmVerify(psbt, 0)).to.eq(true);
    });

    it('should fail with dynamic flag mismatch (expect NONE but sign with ALL)', async () => {
      const contract = new CheckSigWithFlagTest();
      const address = await testSigner.getAddress();
      const pubKey = await testSigner.getPublicKey();

      contract.bindToUtxo({
        txId: 'c1a1a777a52f765ebfa295a35c12280279edd46073d41f4767602f819f574f82',
        outputIndex: 0,
        satoshis: 10000,
        data: '',
      });

      // This test verifies that checkSigWithFlag correctly rejects signatures
      // when the flag doesn't match. The method uses SIGHASH_ALL, but we pass
      // expectedFlag=2 (NONE), so the verification should fail.
      let error: Error | undefined;
      try {
        const psbt = new ExtPsbt({ network: testSigner.network })
          .addContractInput(contract, (c, psbt) => {
            const sig = psbt.getSig(0, { address });
            // Sign with SIGHASH_ALL (1) but expect SIGHASH_NONE (2)
            c.unlockWithDynamicFlag(sig, PubKey(pubKey), 2n);
          })
          .change(address, 1)
          .seal();

        await psbt.signAndFinalize(testSigner);
      } catch (e) {
        error = e as Error;
      }

      // The TypeScript runtime check in checkSigWithFlag should throw an error
      // because the signature flag (1) doesn't match the expected flag (2)
      expect(error).to.be.instanceOf(Error);
      expect(error?.message).to.include('signature flag mismatch');
    });
  });

  describe('unlockWithMismatchedFlag - decorator vs checkSigWithFlag mismatch', () => {
    it('should fail when decorator sigHashType (ALL) differs from checkSigWithFlag flag (NONE)', async () => {
      const contract = new CheckSigWithFlagTest();
      const address = await testSigner.getAddress();
      const pubKey = await testSigner.getPublicKey();

      contract.bindToUtxo({
        txId: 'c1a1a777a52f765ebfa295a35c12280279edd46073d41f4767602f819f574f82',
        outputIndex: 0,
        satoshis: 10000,
        data: '',
      });

      // The unlockWithMismatchedFlag method has sigHashType.ALL decorator (1)
      // but calls checkSigWithFlag with flag=2 (NONE).
      // This should fail because the signature is created with flag=1,
      // but checkSigWithFlag verifies for flag=2.
      let error: Error | undefined;
      try {
        const psbt = new ExtPsbt({ network: testSigner.network })
          .addContractInput(contract, (c, psbt) => {
            const sig = psbt.getSig(0, { address });
            c.unlockWithMismatchedFlag(sig, PubKey(pubKey));
          })
          .change(address, 1)
          .seal();

        await psbt.signAndFinalize(testSigner);
      } catch (e) {
        error = e as Error;
      }

      // The assertion in checkSigWithFlag should throw an error
      // because the signature flag (1) doesn't match the expected flag (2)
      expect(error).to.be.instanceOf(Error);
      expect(error?.message).to.include('signature flag mismatch');
    });
  });
});
