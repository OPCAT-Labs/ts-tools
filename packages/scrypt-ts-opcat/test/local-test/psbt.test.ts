import * as dotenv from 'dotenv';
import {
  DefaultSigner,
  hash160,
  ExtPsbt,
  PrivateKey,
  PubKey,
} from '@opcat-labs/scrypt-ts-opcat';

import { readArtifact, getDummyUtxo } from '../utils/index.js';
import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { P2PKH } from '../contracts/p2pkh.js';

dotenv.config();

use(chaiAsPromised);

describe('Test ExtPsbt Serialization', () => {
  const testSigner = new DefaultSigner(PrivateKey.fromRandom());

  before(() => {
    P2PKH.loadArtifact(readArtifact('p2pkh.json'));
  });

  /**
   * Helper function to create and finalize a PSBT with a P2PKH contract input
   */
  async function createAndFinalizePsbt(feeAmount: number = 50000): Promise<ExtPsbt> {
    const pubKey = await testSigner.getPublicKey();
    const pkh = hash160(pubKey);
    const address = await testSigner.getAddress();

    // Create a contract input
    const contract = new P2PKH(pkh);
    contract.bindToUtxo({
      txId: 'c1a1a777a52f765ebfa295a35c12280279edd46073d41f4767602f819f574f82',
      outputIndex: 0,
      satoshis: 10000,
      data: ''
    });

    // Create PSBT with contract input and fee input (using P2PKH UTXO)
    const psbt = new ExtPsbt({ network: testSigner.network })
      .addContractInput(contract, (p2pkh, psbt) => {
        const sig = psbt.getSig(0, { address: address });
        p2pkh.unlock(sig, PubKey(pubKey));
      })
      .spendUTXO(getDummyUtxo(address, feeAmount))
      .change(address, 1)
      .seal();

    // Sign and finalize
    await psbt.signAndFinalize(testSigner);
    return psbt;
  }

  it('should properly preserve isSealed state after finalize -> toHex -> fromHex roundtrip', async () => {
    const psbt = await createAndFinalizePsbt(50000);

    // Verify the PSBT is finalized
    expect(psbt.isFinalized).to.be.true;
    expect(psbt.isSealed).to.be.true;

    // Serialize to hex
    const psbtHex = psbt.toHex();
    expect(psbtHex).to.be.a('string');

    // Deserialize from hex
    const deserializedPsbt = ExtPsbt.fromHex(psbtHex, { network: testSigner.network });

    // Bug fix verification: After deserialization, even though isSealed is false,
    // since isFinalized is true, methods like getUtxo() and toHex() should work
    expect(deserializedPsbt.isFinalized).to.be.true;

    // These calls should NOT throw "should call seal() before" error
    expect(() => deserializedPsbt.toHex()).to.not.throw();
    expect(() => deserializedPsbt.toBase64()).to.not.throw();
    expect(() => deserializedPsbt.txHashPreimage()).to.not.throw();
    expect(() => deserializedPsbt.getUtxo(0)).to.not.throw();

    // Verify the serialized data is consistent
    const reserialized = deserializedPsbt.toHex();
    expect(reserialized).to.equal(psbtHex);
  });

  it('should properly preserve isSealed state after finalize -> toBase64 -> fromBase64 roundtrip', async () => {
    const psbt = await createAndFinalizePsbt(50000);

    // Verify the PSBT is finalized
    expect(psbt.isFinalized).to.be.true;
    expect(psbt.isSealed).to.be.true;

    // Serialize to base64
    const psbtBase64 = psbt.toBase64();
    expect(psbtBase64).to.be.a('string');

    // Deserialize from base64
    const deserializedPsbt = ExtPsbt.fromBase64(psbtBase64, { network: testSigner.network });

    // Bug fix verification: After deserialization, even though isSealed is false,
    // since isFinalized is true, methods like getUtxo() and toBase64() should work
    expect(deserializedPsbt.isFinalized).to.be.true;

    // These calls should NOT throw "should call seal() before" error
    expect(() => deserializedPsbt.toHex()).to.not.throw();
    expect(() => deserializedPsbt.toBase64()).to.not.throw();
    expect(() => deserializedPsbt.txHashPreimage()).to.not.throw();
    expect(() => deserializedPsbt.getUtxo(0)).to.not.throw();

    // Verify the serialized data is consistent
    const reserialized = deserializedPsbt.toBase64();
    expect(reserialized).to.equal(psbtBase64);
  });

  it('should handle multiple serialization roundtrips correctly', async () => {
    const psbt = await createAndFinalizePsbt(30000);

    const hex1 = psbt.toHex();
    const psbt2 = ExtPsbt.fromHex(hex1, { network: testSigner.network });
    const hex2 = psbt2.toHex();
    const psbt3 = ExtPsbt.fromHex(hex2, { network: testSigner.network });
    const hex3 = psbt3.toHex();

    // All serializations should be identical
    expect(hex1).to.equal(hex2);
    expect(hex2).to.equal(hex3);

    // All instances should allow calling getUtxo
    expect(() => psbt.getUtxo(0)).to.not.throw();
    expect(() => psbt2.getUtxo(0)).to.not.throw();
    expect(() => psbt3.getUtxo(0)).to.not.throw();
  });

  it('should still throw error when calling methods on unsealed and unfinalized PSBT', async () => {
    const address = await testSigner.getAddress();
    const psbt = new ExtPsbt();

    // Add an input but don't seal or finalize
    psbt.spendUTXO(getDummyUtxo(address, 10000));

    // For unsealed and unfinalized PSBT, these methods should throw
    expect(() => psbt.toHex()).to.throw('should call seal() before toHex()');
    expect(() => psbt.toBase64()).to.throw('should call seal() before toBase64()');
    expect(() => psbt.toBuffer()).to.throw('should call seal() before toBuffer()');
    expect(() => psbt.txHashPreimage()).to.throw('should call seal() before txHashPreimage()');
  });

  it('should allow txHashPreimage on finalized but unsealed PSBT after deserialization', async () => {
    const psbt = await createAndFinalizePsbt(40000);

    const preimage1 = psbt.txHashPreimage();
    expect(preimage1).to.be.a('string');
    expect(preimage1.length).to.be.greaterThan(0);

    // Deserialize
    const psbt2 = ExtPsbt.fromHex(psbt.toHex(), { network: testSigner.network });

    // Should be able to get preimage without re-sealing
    const preimage2 = psbt2.txHashPreimage();
    expect(preimage2).to.equal(preimage1);
  });

  it('should allow multiple addOutput calls without seal (no inputs)', async () => {
    const address = await testSigner.getAddress();
    const pubKey = await testSigner.getPublicKey();
    const pkh = hash160(pubKey);
    const script = Buffer.from('76a914' + pkh + '88ac', 'hex');
    const psbt = new ExtPsbt({ network: testSigner.network });

    // First addOutput - should work
    expect(() => {
      psbt.addOutput({
        script: script,
        value: BigInt(10000),
        data: Buffer.from(''),
      });
    }).to.not.throw();

    // Second addOutput - should also work (not sealed yet)
    expect(() => {
      psbt.addOutput({
        script: script,
        value: BigInt(20000),
        data: Buffer.from(''),
      });
    }).to.not.throw();

    // Verify both outputs were added
    expect(psbt.txOutputs).to.have.length(2);
    expect(psbt.txOutputs[0].value).to.equal(BigInt(10000));
    expect(psbt.txOutputs[1].value).to.equal(BigInt(20000));
  });

  it('should throw error on addOutput after seal', async () => {
    const address = await testSigner.getAddress();
    const pubKey = await testSigner.getPublicKey();
    const pkh = hash160(pubKey);
    const script = Buffer.from('76a914' + pkh + '88ac', 'hex');
    const psbt = new ExtPsbt({ network: testSigner.network });

    // Add output - should work
    psbt.addOutput({
      script: script,
      value: BigInt(10000),
      data: Buffer.from(''),
    });

    // Add input to make seal() work properly
    psbt.spendUTXO(getDummyUtxo(address, 100000));

    // Seal the PSBT
    psbt.seal();

    // Try to add another output - should throw
    expect(() => {
      psbt.addOutput({
        script: script,
        value: BigInt(20000),
        data: Buffer.from(''),
      });
    }).to.throw("This ExtPsbt is not modifiable(sealed or finalized), can't add more output");
  });
});
