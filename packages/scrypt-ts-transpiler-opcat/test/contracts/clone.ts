import {
  assert,
  ByteString,
  sha256,
  method,
  SmartContract,
  TxUtils,
} from '@scrypt-inc/scrypt-ts-btc';

export class Clone extends SmartContract {
  constructor() {
    super();
  }

  // see https://scrypt.io/scrypt-ts/getting-started/what-is-scriptcontext#sighash-type
  @method()
  public unlock() {
    // make sure balance in the contract does not change

    const script = this.ctx.spentScripts[Number(this.ctx.inputIndexVal)];
    const amount: ByteString = this.ctx.spentAmounts[Number(this.ctx.inputIndexVal)];

    // output containing the latest state
    const output: ByteString = TxUtils.buildOutput(script, amount);
    // verify current tx has this single output
    assert(this.ctx.shaOutputs == sha256(output), 'shaOutputs mismatch');
  }
}
