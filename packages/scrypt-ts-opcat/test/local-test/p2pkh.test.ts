import * as dotenv from 'dotenv';

import {
  DefaultSigner,
  hash160,
  uint8ArrayToHex,
  ExtPsbt,
  IExtPsbt,
  PubKey,
  Covenant,
  toXOnly,
  bvmVerify,
} from '../../src/index.js';

import { address as Address } from '@scrypt-inc/bitcoinjs-lib';

import { readArtifact } from '../utils/index.js';
import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { P2PKH } from '../contracts/p2pkh.js';

dotenv.config();

use(chaiAsPromised);

describe('Test P2PKH', () => {
  const testSigner = new DefaultSigner();
  before(() => {
    P2PKH.loadArtifact(readArtifact('p2pkh.json'));
  });

  it('should call `unlock` method successfully.', async () => {
    const address = await testSigner.getAddress();
    const pkh = hash160(uint8ArrayToHex(Address.fromBech32(address).data));
    const pubkey = await testSigner.getPublicKey();
    const c = Covenant.createCovenant(new P2PKH(pkh)).bindToUtxo({
      txId: 'c1a1a777a52f765ebfa295a35c12280279edd46073d41f4767602f819f574f82',
      outputIndex: 0,
      satoshis: 10000,
    });

    const psbt = new ExtPsbt().addCovenantInput(c).change(address, 1).seal();

    psbt.updateCovenantInput(0, c, {
      invokeMethod: (p2pkh: P2PKH, psbt: IExtPsbt) => {
        const sig = psbt.getSig(0, { address: address });
        p2pkh.unlock(sig, PubKey(toXOnly(pubkey, true)));
      },
    });

    const signedPsbtHex = await testSigner.signPsbt(psbt.toHex(), psbt.psbtOptions());

    expect(() => {
      psbt.combine(ExtPsbt.fromHex(signedPsbtHex)).finalizeAllInputs();
      expect(bvmVerify(psbt, 0)).to.eq(true);
    }).not.throw();
  });

  it('should signature check failed', async () => {
    const address = await testSigner.getAddress();
    const pkh = hash160(uint8ArrayToHex(Address.fromBech32(address).data));
    const pubkey = await testSigner.getPublicKey();
    const c = Covenant.createCovenant(new P2PKH(pkh)).bindToUtxo({
      txId: 'c1a1a777a52f765ebfa295a35c12280279edd46073d41f4767602f819f574f82',
      outputIndex: 0,
      satoshis: 10000,
    });

    const wrongSigner = new DefaultSigner();
    const wrongAddress = await wrongSigner.getAddress();

    const psbt = new ExtPsbt().addCovenantInput(c).change(address, 1).seal();

    psbt.updateCovenantInput(0, c, {
      invokeMethod: (p2pkh: P2PKH, psbt: IExtPsbt) => {
        const sig = psbt.getSig(0, { address: wrongAddress });
        p2pkh.unlock(sig, PubKey(toXOnly(pubkey, true)));
      },
    });

    const signedPsbtHex = await wrongSigner.signPsbt(psbt.toHex(), {
      autoFinalized: false,
      toSignInputs: [
        {
          address: wrongAddress,
          index: 0,
        },
      ],
    });

    expect(() => {
      psbt.combine(ExtPsbt.fromHex(signedPsbtHex)).finalizeAllInputs();
    }).to.throw(/signature check failed/);
  });
});
