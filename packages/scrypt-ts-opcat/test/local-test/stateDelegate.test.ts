import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
use(chaiAsPromised);
import { DefaultSigner, ExtPsbt, sha256, toByteString } from '@opcat-labs/scrypt-ts-opcat';
import { getDummyUtxo, readArtifact } from '../utils/index.js';

import { StateDelegatee } from '../contracts/stateDelegatee.js';
import { StateDelegator } from '../contracts/stateDelegator.js';
import {
  DelegateeStateLib,
  DelegatorStateLib,
} from '../contracts/stateLibs.js';

describe('Test StateDelegatee & StateDelegator', () => {
  let signer = new DefaultSigner();

  before(() => {
    StateDelegatee.loadArtifact(readArtifact('stateDelegatee.json'));
    StateDelegator.loadArtifact(readArtifact('stateDelegator.json'));
    DelegateeStateLib.loadArtifact(readArtifact('stateLibs.json'));
    DelegatorStateLib.loadArtifact(readArtifact('stateLibs.json'));
  });

  it('should call `StateDelegatee` successfully.', async () => {
    let delegateeCov = await deployStateDelegatee();

    for (let i = 0; i < 1; i++) {
      const { newDelegateeCov } = await testCallDelegatee(delegateeCov, i + 1);
      delegateeCov = newDelegateeCov;
    }
  });

  async function deployStateDelegator(stateDelegatee: StateDelegatee): Promise<StateDelegator> {

    const stateDelegator = new StateDelegator(stateDelegatee.lockingScript.toHex())
    stateDelegator.state = { delegated: false };

    const address = await signer.getAddress();

    const psbt = new ExtPsbt()
      .spendUTXO(getDummyUtxo(address))
      .addContractOutput(stateDelegator, 1000)
      .change(address, 1)
      .seal();

    await psbt.signAndFinalize(signer);

    return stateDelegator;
  }

  async function deployStateDelegatee() {
    const stateDelegatee = new StateDelegatee();
    stateDelegatee.state = { total: 0n };
    const address = await signer.getAddress();

    const psbt = new ExtPsbt()
      .spendUTXO(getDummyUtxo(address))
      .addContractOutput(stateDelegatee, 1000)
      .change(address, 1)
      .seal();

    await psbt.signAndFinalize(signer);


    return stateDelegatee;
  }



  async function buildCallPsbt(
    delegatorCov: StateDelegator,
    delegateeCov: StateDelegatee,
  ) {
    const address = await signer.getAddress();

    const newDelagatorCov = delegatorCov.next({ delegated: true });
    const newDelegateeCov = delegateeCov.next({ total: delegateeCov.state.total + 1n });
    const psbt = new ExtPsbt()
      .addContractInput(delegatorCov, (contract) => {
        contract.unlock();
      })
      .addContractInput(delegateeCov,  (contract) => {
        contract.unlock(sha256(toByteString(delegatorCov.lockingScript.toHex())), delegatorCov.state, 0n);
      })
      .spendUTXO(getDummyUtxo(address))
      .addContractOutput(newDelagatorCov, 1000)
      .addContractOutput(newDelegateeCov, 1000)
      .change(address, 1)
      .seal();

    await psbt.signAndFinalize(signer);
    return {
      psbt,
      newDelagatorCov,
      newDelegateeCov,
    };
  }

  async function testCallDelegatee(
    delegateeCov: StateDelegatee,
    expectedTotal: number,
  ) {
    // deploy a new delegator
    const delegatorCov: StateDelegator = await deployStateDelegator(delegateeCov);

    const { psbt, newDelagatorCov, newDelegateeCov } = await buildCallPsbt(
      delegatorCov,
      delegateeCov,
    );

    expect(psbt.isFinalized).to.be.true;

    expect(newDelagatorCov.state.delegated).to.be.true;
    expect(newDelegateeCov.state.total).to.equal(BigInt(expectedTotal));

    // invalid case: delegator has been already delegated
    await expect(buildCallPsbt(newDelagatorCov, newDelegateeCov))
    .to.be.rejectedWith(/Delegator has been already delegated/);

    return {
      newDelegateeCov,
      psbt,
    };
  }
});
