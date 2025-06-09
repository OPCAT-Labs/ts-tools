import {
  ExtPsbt,
  fillFixedArray,
  toByteString,
  TX_INPUT_COUNT_MAX,
  TX_OUTPUT_COUNT_MAX,
  uint8ArrayToHex,
  Covenant,
  bvmVerify,
} from '../../src/index.js';
import { bigintToByteString } from '../../src/utils/common.js';

import { VerifyContext } from '../contracts/verifyContext.js';

import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { readArtifact } from '../utils/index.js';
use(chaiAsPromised);

describe('Test Contract with verifyContext', () => {
  before(() => {
    VerifyContext.loadArtifact(readArtifact('verifyContext.json'));
  });

  it('should call `unlock` method successfully.', async () => {
    const covenant0 = Covenant.createCovenant(new VerifyContext()).bindToUtxo({
      txId: 'c1a1a777a52f765ebfa295a35c12280279edd46073d41f4767602f819f574f82',
      outputIndex: 0,
      satoshis: 10000,
    });

    const covenant1 = Covenant.createCovenant(new VerifyContext()).bindToUtxo({
      txId: 'bf49dfd9eeb884a05afbb68219fb0d8a7a4c3aa2e1f630e387d85dddaec03341',
      outputIndex: 1,
      satoshis: 20000,
    });

    const psbt = new ExtPsbt()
      // add covenant0 and covenant1 to test the context for different inputs
      .addCovenantInput(covenant0)
      .addCovenantInput(covenant1)
      .addOutput({
        address: 'bc1pltqlwt7ru0aj6vycyjwea24nlkkltvkk7lwkj5mne5nnzakvn6gq52nf5h',
        value: 2n,
      })
      .change('bc1pltqlwt7ru0aj6vycyjwea24nlkkltvkk7lwkj5mne5nnzakvn6gq52nf5h', 1)
      .seal();

    const formatArgs = (psbt: ExtPsbt) => {
      const sequences = fillFixedArray(toByteString(''), TX_INPUT_COUNT_MAX);
      psbt.txInputs.forEach((input, index) => {
        sequences[index] = bigintToByteString(BigInt(input.sequence), 4n);
      });

      const outputSatoshisListExceptChange = fillFixedArray(toByteString(''), TX_OUTPUT_COUNT_MAX);
      psbt.txOutputs.forEach((output, index) => {
        if (index === psbt.txOutputs.length - 1) return;
        outputSatoshisListExceptChange[index] = bigintToByteString(BigInt(output.value), 8n);
      });

      const outputScriptListExceptChange = fillFixedArray(toByteString(''), TX_OUTPUT_COUNT_MAX);
      psbt.txOutputs.forEach((output, index) => {
        if (index === psbt.txOutputs.length - 1) return;
        outputScriptListExceptChange[index] = uint8ArrayToHex(output.script);
      });
      return { sequences, outputScriptListExceptChange, outputSatoshisListExceptChange };
    };

    psbt
      .updateCovenantInput(0, covenant0, {
        invokeMethod: (contract: VerifyContext) => {
          const { sequences, outputScriptListExceptChange, outputSatoshisListExceptChange } =
            formatArgs(psbt);
          contract.unlock(
            bigintToByteString(BigInt(psbt.locktime), 4n),
            sequences,
            BigInt(psbt.txInputs.length),
            BigInt(0),
            outputScriptListExceptChange,
            outputSatoshisListExceptChange,
          );
        },
      })
      .updateCovenantInput(1, covenant1, {
        invokeMethod: (contract: VerifyContext) => {
          const { sequences, outputScriptListExceptChange, outputSatoshisListExceptChange } =
            formatArgs(psbt);
          contract.unlock(
            bigintToByteString(BigInt(psbt.locktime), 4n),
            sequences,
            BigInt(psbt.txInputs.length),
            BigInt(1),
            outputScriptListExceptChange,
            outputSatoshisListExceptChange,
          );
        },
      })
      .finalizeAllInputs();

    expect(psbt.isFinalized).to.be.true;
    expect(bvmVerify(psbt, 0)).to.eq(true);
    expect(bvmVerify(psbt, 1)).to.eq(true);
  });
});
