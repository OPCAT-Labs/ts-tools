import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';

import { AccumulatorMultiSig } from '../contracts/accumulatorMultiSig.js';
import { readArtifact } from '../utils/index.js';
import {
  DefaultSigner,
  ExtPsbt,
  IExtPsbt,
  PubKey,
  Sig,
  bvmVerify,
  hash160,
} from '@opcat-labs/scrypt-ts-opcat';

use(chaiAsPromised);

describe('Test SmartContract `AccumulatorMultiSig`', () => {
  before(() => {
    AccumulatorMultiSig.loadArtifact(readArtifact('accumulatorMultiSig.json'));
  });

  it('should successfully with all three right.', async () => {
    const testSigner1 = new DefaultSigner();
    const address1 = await testSigner1.getAddress();
    const publicKey1 = await testSigner1.getPublicKey();
    const pkh1 = hash160(publicKey1);

    const testSigner2 = new DefaultSigner();
    const address2 = await testSigner2.getAddress();
    const publicKey2 = await testSigner2.getPublicKey();
    const pkh2 = hash160(publicKey2);

    const testSigner3 = new DefaultSigner();
    const address3 = await testSigner3.getAddress();
    const publicKey3 = await testSigner3.getPublicKey();
    const pkh3 = hash160(publicKey3);

    const threshold = BigInt(AccumulatorMultiSig.N);
    const c = new AccumulatorMultiSig(threshold, [pkh1, pkh2, pkh3]);
    c.bindToUtxo({
      txId: 'c1a1a777a52f765ebfa295a35c12280279edd46073d41f4767602f819f574f82',
      outputIndex: 0,
      satoshis: 10000,
      data: ''
    });

    const psbt = new ExtPsbt()
      .addContractInput(c, (accumulatorMultiSig, psbt) => {
        const sig1 = psbt.getSig(0, { address: address1 });
        const sig2 = psbt.getSig(0, { address: address2 });
        const sig3 = psbt.getSig(0, { address: address3 });
        accumulatorMultiSig.main(
          [PubKey(publicKey1), PubKey(publicKey2), PubKey(publicKey3)],
          [sig1, sig2, sig3],
          [true, true, true],
        );
      })
      .change(address1, 1)
      .seal();


    const signedPsbtHex1 = await testSigner1.signPsbt(psbt.toHex(), {
      autoFinalized: false,
      toSignInputs: [
        {
          index: 0,
          publicKey: publicKey1,
        },
      ],
    });

    const signedPsbtHex2 = await testSigner2.signPsbt(psbt.toHex(), {
      autoFinalized: false,
      toSignInputs: [
        {
          index: 0,
          publicKey: publicKey2,
        },
      ],
    });

    const signedPsbtHex3 = await testSigner3.signPsbt(psbt.toHex(), {
      autoFinalized: false,
      toSignInputs: [
        {
          index: 0,
          publicKey: publicKey3,
        },
      ],
    });

    expect(() => {
      psbt
        .combine(ExtPsbt.fromHex(signedPsbtHex1))
        .combine(ExtPsbt.fromHex(signedPsbtHex2))
        .combine(ExtPsbt.fromHex(signedPsbtHex3))
        .finalizeAllInputs();
    }).not.throw();

    expect(psbt.isFinalized, 'not Finalized').to.eq(true);
    expect(bvmVerify(psbt, 0)).to.eq(true);
  });

  it('should successfully with two right.', async () => {
    const testSigner1 = new DefaultSigner();
    const address1 = await testSigner1.getAddress();
    const publicKey1 = await testSigner1.getPublicKey();
    const pkh1 = hash160(publicKey1);

    const testSigner2 = new DefaultSigner();
    const address2 = await testSigner2.getAddress();
    const publicKey2 = await testSigner2.getPublicKey();
    const pkh2 = hash160(publicKey2);

    const testSigner3 = new DefaultSigner();
    const publicKey3 = await testSigner3.getPublicKey();
    const pkh3 = hash160(publicKey3);

    const threshold = 2n;
    const c =new AccumulatorMultiSig(threshold, [pkh1, pkh2, pkh3]);
    c.bindToUtxo({
      txId: 'c1a1a777a52f765ebfa295a35c12280279edd46073d41f4767602f819f574f82',
      outputIndex: 0,
      satoshis: 10000,
      data: ''
    });

    const psbt = new ExtPsbt()
      .addContractInput(c, (accumulatorMultiSig, psbt) => {
        const sig1 = psbt.getSig(0, { address: address1 });
        const sig2 = psbt.getSig(0, { address: address2 });
        const sig3 = Sig('00'.repeat(32));
        accumulatorMultiSig.main(
          [PubKey(publicKey1), PubKey(publicKey2), PubKey(publicKey3)],
          [sig1, sig2, sig3],
          [true, true, false],
        );
      })
      .change(address1, 1)
      .seal();

    const signedPsbtHex1 = await testSigner1.signPsbt(psbt.toHex(), {
      autoFinalized: false,
      toSignInputs: [
        {
          index: 0,
          publicKey: publicKey1,
        },
      ],
    });

    const signedPsbtHex2 = await testSigner2.signPsbt(psbt.toHex(), {
      autoFinalized: false,
      toSignInputs: [
        {
          index: 0,
          publicKey: publicKey2,
        },
      ],
    });

    expect(() => {
      psbt
        .combine(ExtPsbt.fromHex(signedPsbtHex1))
        .combine(ExtPsbt.fromHex(signedPsbtHex2))
        .finalizeAllInputs();
    }).not.throw();

    expect(psbt.isFinalized, 'not Finalized').to.eq(true);
    expect(bvmVerify(psbt, 0)).to.eq(true);
  });

  it('should throw with only one right.', async () => {
    const testSigner1 = new DefaultSigner();
    const address1 = await testSigner1.getAddress();
    const publicKey1 = await testSigner1.getPublicKey();
    const pkh1 = hash160(publicKey1);

    const testSigner2 = new DefaultSigner();
    const _address2 = await testSigner2.getAddress();
    const publicKey2 = await testSigner2.getPublicKey();
    const pkh2 = hash160(publicKey2);

    const testSigner3 = new DefaultSigner();
    const publicKey3 = await testSigner3.getPublicKey();
    const pkh3 = hash160(publicKey3);

    const threshold = 2n;
    const c = new AccumulatorMultiSig(threshold, [pkh1, pkh2, pkh3]);
    c.bindToUtxo({
      txId: 'c1a1a777a52f765ebfa295a35c12280279edd46073d41f4767602f819f574f82',
      outputIndex: 0,
      satoshis: 10000,
      data: ''
    });

    const psbt = new ExtPsbt()
      .addContractInput(c, (accumulatorMultiSig: AccumulatorMultiSig, psbt: IExtPsbt) => {
        const sig1 = psbt.getSig(0, { address: address1 });
        const sig2 = Sig('00'.repeat(32));
        const sig3 = Sig('00'.repeat(32));
        accumulatorMultiSig.main(
          [PubKey(publicKey1), PubKey(publicKey2), PubKey(publicKey3)],
          [sig1, sig2, sig3],
          [true, true, false],
        );
      })
      .change(address1, 1)
      .seal();

    const signedPsbtHex1 = await testSigner1.signPsbt(psbt.toHex(), {
      autoFinalized: false,
      toSignInputs: [
        {
          index: 0,
          publicKey: publicKey1,
        },
      ],
    });

    expect(() => {
      psbt.combine(ExtPsbt.fromHex(signedPsbtHex1)).finalizeAllInputs();
    }).to.throw(/signature check failed/);
  });
});
