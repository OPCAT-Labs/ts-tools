import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { getDefaultProvider, getDefaultSigner } from './utils/helper.js';
import { BacktraceInfo, call, deployGenesis, IExtPsbt, Signer } from '@opcat-labs/scrypt-ts-opcat';
import { B2GCounter } from '..'
use(chaiAsPromised);

describe('Test B2GCounter onchain', () => {
  let signer: Signer = getDefaultSigner();
  let provider = getDefaultProvider();
  let counter: B2GCounter
  before(async () => {

  });

  it('should deploy successfully', async () => {

    const address = await signer.getAddress();
    const { psbt, contract } = await deployGenesis(signer, provider, (genesisOutpoint) => {
      const counter = new B2GCounter(genesisOutpoint);
      counter.state = { count: 0n };
      return counter;
    });
    counter = contract as B2GCounter;
    expect(psbt.isFinalized).to.be.true;
    console.info('deployed successfully, txid: ', psbt.extractTransaction().id);
  });

  it('should increase', async () => {

    for (let i = 0; i < 10; i++) {
      const newContract = counter.next({ count: counter.state.count + 1n });

      const psbt = await call(
        signer,
        provider,
        counter,
        (contract: B2GCounter, psbt: IExtPsbt, backtraceInfo: BacktraceInfo) => {
          contract.increase(backtraceInfo);
        },
        { contract: newContract, satoshis: 1, withBackTraceInfo: true },
      );

      expect(psbt.isFinalized).to.be.true;

      const txid = psbt.extractTransaction().id;
      console.info('increased successfully, txid: ', txid);

      counter = newContract
    }
  });
});
