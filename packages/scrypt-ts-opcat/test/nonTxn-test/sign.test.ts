import { getDummyUtxo, readArtifact } from '../utils/index.js';
import { IExtPsbt } from '../../src/psbt/types.js';
import {
  DefaultSigner,
  PubKey,
  toXOnly,
  hash160,
  Covenant,
  ToSignInput,
  ExtPsbt,
  bvmVerify,
} from '../../src/index.js';
import { AddressType } from '../../src/signers/defaultSigner.js';
import { P2PKH } from '../contracts/p2pkh.js';
import { expect } from 'chai';

describe('Test sign', () => {
  before(async () => {
    P2PKH.loadArtifact(readArtifact('p2pkh.json'));
  });

  describe('Sign with address', () => {
    it('should succeed when using p2tr address', async () => {
      const signer = new DefaultSigner(undefined, undefined, AddressType.P2TR);
      await testCase(signer, {
        address: await signer.getAddress(),
      });
    });

    it('should succeed when using p2wpkh address', async () => {
      const signer = new DefaultSigner(undefined, undefined, AddressType.P2WPKH);
      await testCase(signer, {
        address: await signer.getAddress(),
      });
    });
  });

  describe('Sign with public key', () => {
    it('should succeed when using p2tr address', async () => {
      const signer = new DefaultSigner(undefined, undefined, AddressType.P2TR);
      await testCase(signer, {
        publicKey: await signer.getPublicKey(),
      });
    });

    it('should succeed when using p2wpkh address', async () => {
      const signer = new DefaultSigner(undefined, undefined, AddressType.P2WPKH);
      await testCase(signer, {
        publicKey: await signer.getPublicKey(),
      });
    });
  });

  describe('Sign with xonly public key', () => {
    it('should succeed when using p2tr address', async () => {
      const signer = new DefaultSigner(undefined, undefined, AddressType.P2TR);
      const xonlyPubKey = PubKey(
        toXOnly(await signer.getPublicKey(), signer.addressType === AddressType.P2TR),
      );
      await testCase(signer, {
        publicKey: xonlyPubKey,
      });
    });

    it('should succeed when using p2wpkh address', async () => {
      const signer = new DefaultSigner(undefined, undefined, AddressType.P2WPKH);
      const xonlyPubKey = PubKey(
        toXOnly(await signer.getPublicKey(), signer.addressType === AddressType.P2TR),
      );
      await testCase(signer, {
        publicKey: xonlyPubKey,
      });
    });
  });

  async function testCase(signer: DefaultSigner, toSignInput: Omit<ToSignInput, 'index'>) {
    const address = await signer.getAddress();
    const xonlyPubKey = PubKey(
      toXOnly(await signer.getPublicKey(), signer.addressType === AddressType.P2TR),
    );
    const pkh = hash160(xonlyPubKey);
    const covenant = Covenant.createCovenant(new P2PKH(pkh)).bindToUtxo({
      txId: 'c1a1a777a52f765ebfa295a35c12280279edd46073d41f4767602f819f574f82',
      outputIndex: 0,
      satoshis: 10000,
    });

    const psbt = new ExtPsbt()
      .addCovenantInput(covenant)
      .spendUTXO(await getDummyUtxo(address))
      .change(address, 1)
      .seal();

    psbt.updateCovenantInput(0, covenant, {
      invokeMethod: (p2pkh: P2PKH, psbt: IExtPsbt) => {
        const sig = psbt.getSig(0, toSignInput);
        p2pkh.unlock(sig, xonlyPubKey);
      },
    });

    const signedPsbtHex = await signer.signPsbt(psbt.toHex(), psbt.psbtOptions());

    psbt.combine(ExtPsbt.fromHex(signedPsbtHex)).finalizeAllInputs();
    expect(psbt.isFinalized).to.eq(true);
    expect(bvmVerify(psbt, 0)).to.eq(true);
    expect(bvmVerify(psbt, 1)).to.eq(true);
  }
});
