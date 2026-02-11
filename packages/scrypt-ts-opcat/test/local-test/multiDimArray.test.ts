import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
use(chaiAsPromised);

import { DefaultSigner, ExtPsbt } from '@opcat-labs/scrypt-ts-opcat';
import { getDummyUtxo } from '../utils/index.js';
import { serializeState, deserializeState } from '../../src/smart-contract/stateSerializer.js';

import { MultiDimArray, MultiDimArrayState, MultiDimArrayStateLib } from '../contracts/MultiDimArray.js';
import artifact from '../fixtures/MultiDimArray.json' with { type: 'json' };

describe('Test MultiDimArray', () => {
  let testSigner: DefaultSigner;

  before(() => {
    testSigner = new DefaultSigner();

    MultiDimArray.loadArtifact(artifact);
    MultiDimArrayStateLib.loadArtifact(artifact);
  });

  it('should increment', async () => {
    let MultiDimArray = await deployMultiDimArray();

    
    const newContract = await testMove(MultiDimArray);
    MultiDimArray = newContract;

  });

  it('should serialize and deserialize state correctly', () => {
    const multiDimArray = new MultiDimArray();
    multiDimArray.state = { board: [[1n, 2n, 3n], [4n, 5n, 6n], [7n, 8n, 9n]] };
    const stateTypeName = '_opcat_labs_scrypt_ts_opcat_3_2_0__rs__MultiDimArrayState';
    const serializedState = serializeState(artifact, stateTypeName, multiDimArray.state);
    const deserializedState= deserializeState<MultiDimArrayState>(artifact, stateTypeName, serializedState);
    expect(deepEqualArrays(deserializedState.board, multiDimArray.state.board)).to.be.true;
  });

  function deepEqualArrays(a: any[], b: any[]): boolean {
    if (!Array.isArray(a) || !Array.isArray(b)) return a === b;
    if (a.length !== b.length) return false;

    for (let i = 0; i < a.length; i++) {
      if (!deepEqualArrays(a[i], b[i])) return false;
    }

    return true;
  }


  async function deployMultiDimArray(): Promise<MultiDimArray> {
    const multiDimArray = new MultiDimArray();
    multiDimArray.state = { board: [[0n, 0n, 0n], [0n, 0n, 0n], [0n, 0n, 0n]] };

    const address = await testSigner.getAddress();
    const psbt = new ExtPsbt()
      .spendUTXO(getDummyUtxo(address))
      .addContractOutput(multiDimArray,1)
      .change(address, 1)
      .seal();

    await psbt.signAndFinalize(testSigner);

    expect(psbt.isFinalized).to.be.true;
    return multiDimArray;
  }

  async function testMove(MultiDimArray: MultiDimArray) : Promise<MultiDimArray> {
    const newContract = MultiDimArray.next({ board: [[1n, 0n, 0n], [0n, 0n, 0n], [0n, 0n, 0n]] });
    const address = await testSigner.getAddress();
    const psbt = new ExtPsbt()
      .addContractInput(MultiDimArray,  (contract) => {
        contract.move(0n, 0n, 1n);
      })
      .spendUTXO(getDummyUtxo(address))
      .addContractOutput(newContract, 1)
      .change(address, 1)
      .seal()

    await psbt.signAndFinalize(testSigner);

    expect(psbt.isFinalized).to.be.true;

    return newContract
  }
});

