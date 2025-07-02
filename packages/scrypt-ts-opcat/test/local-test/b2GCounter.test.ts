import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { BacktraceInfo, call,  deployGenesis, IExtPsbt, Signer } from '../../src/index.js';
import { B2GCounter } from '../contracts/b2GCounter.js'
import { getDefaultSigner, getDefaultProvider, sleep, readArtifact } from '../utils/index.js';
use(chaiAsPromised);

describe('Test B2GCounter local', () => {
  let signer: Signer = getDefaultSigner();
  let provider = getDefaultProvider();
  let counter: B2GCounter
  before(async () => {
    B2GCounter.loadArtifact(readArtifact('b2GCounter.json'));
  });

  it('should deploy successfully', async () => {

    const address = await signer.getAddress();
    const {psbt, contract} = await deployGenesis(signer, provider, (genesisOutpoint) => {
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
