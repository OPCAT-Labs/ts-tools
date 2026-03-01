import {
  SmartContract,
  method,
  assert,
  Sig,
  PubKey,
} from '@opcat-labs/scrypt-ts-opcat';

// Local SigHashType object for decorator parameters
// This is needed because const enum is not available at runtime in tsx
const SigHashType = {
  ALL: 0x01,
  NONE: 0x02,
  SINGLE: 0x03,
  ANYONECANPAY_ALL: 0x81,
  ANYONECANPAY_NONE: 0x82,
  ANYONECANPAY_SINGLE: 0x83,
} as const;

/**
 * Test contract with multiple methods using different sigHashTypes
 * Each public method uses a different sigHashType decorator
 */
export class MultiSigHashMethods extends SmartContract {
  // ALL (0x01) - signs all inputs and outputs, can use buildChangeOutput()
  @method({ sigHashType: SigHashType.ALL })
  public unlockAll(sig: Sig, pubKey: PubKey) {
    assert(this.ctx.sigHashType === 1n, 'sigHashType should be ALL (1)');
    const outputs = this.buildChangeOutput();
    assert(this.checkOutputs(outputs), 'outputs mismatch');
    assert(this.checkSig(sig, pubKey), 'signature check failed');
  }

  // NONE (0x02) - signs only inputs, outputs can be modified
  @method({ sigHashType: SigHashType.NONE })
  public unlockNone(sig: Sig, pubKey: PubKey) {
    assert(this.ctx.sigHashType === 2n, 'sigHashType should be NONE (2)');
    assert(this.checkSig(sig, pubKey), 'signature check failed');
  }

  // SINGLE (0x03) - signs input and corresponding output at same index
  @method({ sigHashType: SigHashType.SINGLE })
  public unlockSingle(sig: Sig, pubKey: PubKey) {
    assert(this.ctx.sigHashType === 3n, 'sigHashType should be SINGLE (3)');
    assert(this.checkSig(sig, pubKey), 'signature check failed');
  }

  // ANYONECANPAY_ALL (0x81) - allows additional inputs, signs all outputs, can use buildChangeOutput()
  @method({ sigHashType: SigHashType.ANYONECANPAY_ALL })
  public unlockAnyoneCanPayAll(sig: Sig, pubKey: PubKey) {
    assert(this.ctx.sigHashType === 129n, 'sigHashType should be ANYONECANPAY_ALL (129)');
    const outputs = this.buildChangeOutput();
    assert(this.checkOutputs(outputs), 'outputs mismatch');
    assert(this.checkSig(sig, pubKey), 'signature check failed');
  }

  // ANYONECANPAY_NONE (0x82) - allows additional inputs, signs only current input
  @method({ sigHashType: SigHashType.ANYONECANPAY_NONE })
  public unlockAnyoneCanPayNone(sig: Sig, pubKey: PubKey) {
    assert(this.ctx.sigHashType === 130n, 'sigHashType should be ANYONECANPAY_NONE (130)');
    assert(this.checkSig(sig, pubKey), 'signature check failed');
  }

  // ANYONECANPAY_SINGLE (0x83) - allows additional inputs, signs current input and corresponding output
  @method({ sigHashType: SigHashType.ANYONECANPAY_SINGLE })
  public unlockAnyoneCanPaySingle(sig: Sig, pubKey: PubKey) {
    assert(this.ctx.sigHashType === 131n, 'sigHashType should be ANYONECANPAY_SINGLE (131)');
    assert(this.checkSig(sig, pubKey), 'signature check failed');
  }
}
