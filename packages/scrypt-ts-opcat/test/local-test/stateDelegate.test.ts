import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
use(chaiAsPromised);

import { StatefulCovenant } from '../../src/covenant.js';
import { ByteString, ExtPsbt, StructObject, uint8ArrayToHex } from '../../src/index.js';
import { getDummyExtUtxo, getDummyUtxo, readArtifact } from '../utils/index.js';

import { StateDelegatee } from '../contracts/stateDelegatee.js';
import { StateDelegator } from '../contracts/stateDelegator.js';
import {
  DelegateeState,
  DelegatorState,
  DelegateeStateLib,
  DelegatorStateLib,
} from '../contracts/stateLibs.js';
import { testKeyPair, testTweakedKeyPair } from '../utils/privateKey.js';

describe('Test StateDelegatee & StateDelegator', () => {
  let DELEGATEE_SCRIPT: ByteString;
  let DELEGATOR_SCRIPT: ByteString;

  before(() => {
    StateDelegatee.loadArtifact(readArtifact('stateDelegatee.json'));
    StateDelegator.loadArtifact(readArtifact('stateDelegator.json'));
    DelegateeStateLib.loadArtifact(readArtifact('stateLibs.json'));
    DelegatorStateLib.loadArtifact(readArtifact('stateLibs.json'));

    DELEGATEE_SCRIPT = StatefulCovenant.createCovenant(new StateDelegatee()).lockingScriptHex;
    DELEGATOR_SCRIPT = StatefulCovenant.createCovenant(
      new StateDelegator(DELEGATEE_SCRIPT),
    ).lockingScriptHex;
  });

  it('should call `StateDelegatee` successfully.', async () => {
    let { covenant: delegateeCov } = await deployStateDelegatee();

    for (let i = 0; i < 3; i++) {
      const { newDelegateeCov } = await testCallDelegatee(delegateeCov, i + 1);
      delegateeCov = newDelegateeCov;
    }
  });

  async function deployStateDelegator() {
    const delegator = new StateDelegator(DELEGATEE_SCRIPT);
    delegator.state = { delegated: false };
    const covenant = StatefulCovenant.createCovenant(delegator);
    return deployCovenant(covenant);
  }

  async function deployStateDelegatee() {
    const delegatee = new StateDelegatee();
    delegatee.state = { total: 0n };
    const covenant = StatefulCovenant.createCovenant(delegatee);
    return deployCovenant(covenant);
  }

  async function deployCovenant<T extends StructObject>(covenant: StatefulCovenant<T>) {
    const psbt = new ExtPsbt()
      .spendUTXO(await getDummyUtxo())
      .addCovenantOutput(covenant, 1000)
      .change('bc1pltqlwt7ru0aj6vycyjwea24nlkkltvkk7lwkj5mne5nnzakvn6gq52nf5h', 1)
      .seal();

    covenant.bindToUtxo({
      txId: psbt.unsignedTx.getId(),
      outputIndex: 1,
      satoshis: 1000,
      txoStateHashes: psbt.getTxoStateHashes(),
      txHashPreimage: uint8ArrayToHex(psbt.unsignedTx.toBuffer(undefined, 0, false)),
    });

    return {
      covenant,
      psbt,
    };
  }

  async function buildCallPsbt(
    delegatorCov: StatefulCovenant<DelegatorState>,
    delegateeCov: StatefulCovenant<DelegateeState>,
  ) {
    const newDelagatorCov = delegatorCov.next({ delegated: true });
    const newDelegateeCov = delegateeCov.next({ total: delegateeCov.state.total + 1n });
    const psbt = new ExtPsbt()
      .addCovenantInput(delegatorCov)
      .addCovenantInput(delegateeCov)
      .spendUTXO(await getDummyExtUtxo())
      .addCovenantOutput(newDelagatorCov, 1000)
      .addCovenantOutput(newDelegateeCov, 1000)
      .change('bc1pltqlwt7ru0aj6vycyjwea24nlkkltvkk7lwkj5mne5nnzakvn6gq52nf5h', 1)
      .updateCovenantInput(0, delegatorCov, {
        invokeMethod: (contract: StateDelegator) => {
          contract.unlock();
        },
      })
      .updateCovenantInput(1, delegateeCov, {
        invokeMethod: (contract: StateDelegatee) => {
          contract.unlock(DELEGATOR_SCRIPT, delegatorCov.state, 0n);
        },
      })
      .updateInput(2, {
        tapInternalKey: testKeyPair.publicKey.slice(1, 33),
      })
      .signTaprootInput(2, testTweakedKeyPair)
      .seal();

    return {
      psbt,
      newDelagatorCov,
      newDelegateeCov,
    };
  }

  async function testCallDelegatee(
    delegateeCov: StatefulCovenant<DelegateeState>,
    expectedTotal: number,
  ) {
    // deploy a new delegator
    const { covenant: delegatorCov } = await deployStateDelegator();

    const { psbt, newDelagatorCov, newDelegateeCov } = await buildCallPsbt(
      delegatorCov,
      delegateeCov,
    );

    expect(psbt.finalizeAllInputs().isFinalized).to.be.true;

    // console.log('psbt', psbt.toBase64());

    expect(newDelagatorCov.state.delegated).to.be.true;
    expect(newDelegateeCov.state.total).to.equal(BigInt(expectedTotal));

    // invalid case: delegator has been already delegated
    const { psbt: invalidPsbt } = await buildCallPsbt(newDelagatorCov, newDelegateeCov);
    expect(() => invalidPsbt.finalizeAllInputs()).to.be.throw(
      'Delegator has been already delegated',
    );

    return {
      newDelegateeCov,
      psbt,
    };
  }
});
