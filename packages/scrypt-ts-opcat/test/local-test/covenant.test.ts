import * as dotenv from 'dotenv';
dotenv.config();

import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
use(chaiAsPromised);

import {
  Addr,
  DefaultSigner,
  hash160,
  ExtPsbt,
  IExtPsbt,
  PubKey,
  Covenant,
  toXOnly,
  bvmVerify,
} from '../../src/index.js';

import { AccessContext } from '../contracts/accessContext.js';
import { P2PKH } from '../contracts/p2pkh.js';
import { readArtifact } from '../utils/index.js';

export class TwoContractCovenant extends Covenant {
  constructor(address: Addr) {
    super(
      [
        {
          contract: new AccessContext(),
        },
        {
          contract: new P2PKH(address),
          alias: 'p2pkh',
        },
      ],
      {
        network: 'fractal-testnet',
      },
    );
  }
}

describe('Test Covenant with two SmartContract', () => {
  let testSigner: DefaultSigner;

  before(() => {
    testSigner = new DefaultSigner();
    AccessContext.loadArtifact(readArtifact('accessContext.json'));
    P2PKH.loadArtifact(readArtifact('p2pkh.json'));
  });

  it('should call `unlock` by different script path successfully.', async () => {
    const address = await testSigner.getAddress();
    const pubkey = await testSigner.getPublicKey();
    const pkh = hash160(toXOnly(pubkey, true));
    const covenant = new TwoContractCovenant(pkh).bindToUtxo({
      txId: 'c1a1a777a52f765ebfa295a35c12280279edd46073d41f4767602f819f574f82',
      outputIndex: 0,
      satoshis: 10000,
    });

    // unlock by TestCtx
    const psbt = new ExtPsbt().addCovenantInput(covenant).change(address, 1).seal();

    psbt
      .updateCovenantInput(0, covenant, {
        invokeMethod: (contract: AccessContext) => {
          contract.unlock();
        },
      })
      .finalizeAllInputs();

    expect(psbt.isFinalized).to.be.true;

    // unlock by P2PKH
    const psbtp2kh = new ExtPsbt().addCovenantInput(covenant, 'p2pkh').change(address, 1).seal();

    psbtp2kh.updateCovenantInput(0, covenant, {
      contractAlias: 'p2pkh',
      invokeMethod: (p2pkh: P2PKH, psbt: IExtPsbt) => {
        const sig = psbt.getSig(0, { address: address });
        p2pkh.unlock(sig, PubKey(toXOnly(pubkey, true)));
      },
    });

    const signedPsbtHex = await testSigner.signPsbt(psbtp2kh.toHex(), psbtp2kh.psbtOptions());

    expect(() => {
      psbtp2kh.combine(ExtPsbt.fromHex(signedPsbtHex)).finalizeAllInputs();
      expect(bvmVerify(psbt, 0)).to.eq(true);
    }).not.throw();
  });
});
