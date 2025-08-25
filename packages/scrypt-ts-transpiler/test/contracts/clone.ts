import {
  assert,
  ByteString,
  sha256,
  method,
  SmartContract,
  TxUtils,
  hash256,
} from '@opcat-labs/scrypt-ts';


export class Clone extends SmartContract {
  constructor() {
    super();
  }

  @method()
  public unlock() {
    // make sure balance in the contract does not change

    // output containing the latest state
    const output: ByteString = TxUtils.buildOutput(this.ctx.spentScriptHash, this.ctx.value);
    // verify current tx has this single output
    assert(this.ctx.hashOutputs == hash256(output), 'hashOutputs mismatch');
  }
}
